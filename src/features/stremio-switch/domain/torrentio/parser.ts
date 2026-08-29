import {
  ALLOWED_DEBRID_OPTIONS,
  ALLOWED_LANGUAGES,
  ALLOWED_PROVIDERS,
  ALLOWED_QUALITIES,
  ALLOWED_SORTS,
  KNOWN_DEBRID_PROVIDERS,
  LIMIT_REGEX,
  MAX_CONFIG_SEGMENT_LENGTH,
  MAX_URL_LENGTH,
  MAX_VALUE_LENGTH,
  REAL_DEBRID_TOKEN_REGEX,
  SIZE_FILTER_REGEX,
  TORRENTIO_HOST,
} from './constants.ts';
import { TorrentioConfigError } from './errors.ts';
import type {
  RealDebridCredential,
  TorrentioDebridOption,
  TorrentioPublicConfig,
  TorrentioSort,
  ValidatedTorrentioConfig,
} from './types.ts';

// Reject control characters (0x00-0x1F, 0x7F)
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/;

// Reject encoded separators, backslashes, percent signs, and null bytes to prevent canonicalisation ambiguity
const ENCODED_TRAVERSAL_REGEX = /%(?:2f|5c|00|25)/i;

/**
 * Parses and validates an untrusted Torrentio configuration URL for Real-Debrid.
 *
 * Requirements:
 * - Scheme must be strictly HTTPS
 * - Host must be strictly torrentio.strem.fun
 * - Path must be /<configuration>/manifest.json
 * - Debrid provider must be realdebrid with a valid alphanumeric token
 * - All non-secret options must conform to verified Torrentio vocabulary
 */
export function parseTorrentioUrl(rawInput: string): ValidatedTorrentioConfig {
  if (typeof rawInput !== 'string') {
    throw new TorrentioConfigError('INVALID_URL', 'Expected URL to be a string');
  }

  const trimmed = rawInput.trim();

  if (trimmed.length === 0) {
    throw new TorrentioConfigError('INVALID_URL', 'URL cannot be empty');
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new TorrentioConfigError('INVALID_URL', `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`);
  }

  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    throw new TorrentioConfigError('INVALID_URL', 'URL contains invalid control characters');
  }

  if (ENCODED_TRAVERSAL_REGEX.test(trimmed)) {
    throw new TorrentioConfigError('INVALID_URL', 'URL contains suspicious encoded separators or characters');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new TorrentioConfigError('INVALID_URL', 'Failed to parse URL: malformed URL string');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new TorrentioConfigError('UNSUPPORTED_SCHEME', 'Only HTTPS scheme is supported for Torrentio configuration URLs');
  }

  if (parsedUrl.hostname.toLowerCase() !== TORRENTIO_HOST) {
    throw new TorrentioConfigError('UNSUPPORTED_HOST', `Invalid hostname: expected ${TORRENTIO_HOST}`);
  }

  if (parsedUrl.port !== '' && parsedUrl.port !== '443') {
    throw new TorrentioConfigError('UNSUPPORTED_PORT', 'Custom ports are not permitted');
  }

  if (parsedUrl.username !== '' || parsedUrl.password !== '') {
    throw new TorrentioConfigError('INVALID_USERINFO', 'URL userinfo is not permitted');
  }

  if (parsedUrl.search !== '' || parsedUrl.hash !== '') {
    throw new TorrentioConfigError('INVALID_QUERY_OR_FRAGMENT', 'URL search parameters and fragments are not permitted');
  }

  // Ensure path is strictly /<configuration>/manifest.json without duplicate slashes or trailing slash
  const path = parsedUrl.pathname;
  if (path.includes('//') || path.endsWith('/')) {
    throw new TorrentioConfigError('INVALID_PATH', 'Invalid path formatting in Torrentio URL');
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[1] !== 'manifest.json') {
    throw new TorrentioConfigError('INVALID_PATH', 'Expected pathname format: /<configuration>/manifest.json');
  }

  const configSegment = segments[0];
  if (configSegment.length > MAX_CONFIG_SEGMENT_LENGTH) {
    throw new TorrentioConfigError('INVALID_SYNTAX', `Configuration segment exceeds maximum length of ${MAX_CONFIG_SEGMENT_LENGTH} characters`);
  }

  const pairs = configSegment.split('|');
  if (pairs.length === 0) {
    throw new TorrentioConfigError('INVALID_SYNTAX', 'Empty configuration segment');
  }

  const seenKeys = new Set<string>();
  const publicConfig: TorrentioPublicConfig = {};
  let credential: RealDebridCredential | undefined;
  const foundDebridKeys: string[] = [];

  for (const pair of pairs) {
    if (pair === '') {
      throw new TorrentioConfigError('INVALID_SYNTAX', 'Empty item found in configuration string');
    }

    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      throw new TorrentioConfigError('INVALID_SYNTAX', 'Configuration item must be in key=value format');
    }

    if (pair.indexOf('=', eqIdx + 1) !== -1) {
      throw new TorrentioConfigError('INVALID_SYNTAX', 'Multiple "=" characters found in configuration item');
    }

    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);

    if (key === '' || value === '') {
      throw new TorrentioConfigError('INVALID_SYNTAX', 'Configuration key and value must not be empty');
    }

    if (value.length > MAX_VALUE_LENGTH) {
      throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Configuration value for "${key}" exceeds maximum length of ${MAX_VALUE_LENGTH} characters`);
    }

    if (seenKeys.has(key)) {
      throw new TorrentioConfigError('DUPLICATE_OPTION', `Duplicate configuration key: "${key}"`);
    }
    seenKeys.add(key);

    if (key === 'realdebrid') {
      foundDebridKeys.push('realdebrid');
      if (!REAL_DEBRID_TOKEN_REGEX.test(value)) {
        throw new TorrentioConfigError('INVALID_CREDENTIAL', 'Invalid Real-Debrid API token format');
      }
      credential = {
        kind: 'realdebrid',
        secret: value,
      };
    } else if (KNOWN_DEBRID_PROVIDERS.has(key)) {
      foundDebridKeys.push(key);
    } else if (key === 'providers') {
      const providerList = value.split(',');
      if (providerList.length === 0 || providerList.some((p) => p === '')) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', 'Empty provider identifier in providers list');
      }
      for (const p of providerList) {
        if (!ALLOWED_PROVIDERS.has(p)) {
          throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Unsupported provider in configuration: "${p}"`);
        }
      }
      publicConfig.providers = Array.from(new Set(providerList));
    } else if (key === 'sort') {
      if (!ALLOWED_SORTS.has(value as TorrentioSort)) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Unsupported sort option: "${value}"`);
      }
      if (value !== 'quality') {
        publicConfig.sort = value as TorrentioSort;
      }
    } else if (key === 'language') {
      const langList = value.split(',');
      if (langList.length === 0 || langList.some((l) => l === '')) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', 'Empty language identifier in language list');
      }
      for (const l of langList) {
        if (!ALLOWED_LANGUAGES.has(l)) {
          throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Unsupported language in configuration: "${l}"`);
        }
      }
      publicConfig.priorityLanguages = Array.from(new Set(langList));
    } else if (key === 'qualityfilter') {
      const qualityList = value.split(',');
      if (qualityList.length === 0 || qualityList.some((q) => q === '')) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', 'Empty quality identifier in qualityfilter list');
      }
      for (const q of qualityList) {
        if (!ALLOWED_QUALITIES.has(q)) {
          throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Unsupported quality filter in configuration: "${q}"`);
        }
      }
      publicConfig.qualityFilters = Array.from(new Set(qualityList));
    } else if (key === 'limit') {
      if (!LIMIT_REGEX.test(value)) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', 'Limit must be a positive integer between 1 and 999');
      }
      publicConfig.limit = parseInt(value, 10);
    } else if (key === 'sizefilter') {
      if (!SIZE_FILTER_REGEX.test(value)) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Invalid size filter format: "${value}"`);
      }
      publicConfig.sizeFilter = value;
    } else if (key === 'debridoptions') {
      const optList = value.split(',');
      if (optList.length === 0 || optList.some((o) => o === '')) {
        throw new TorrentioConfigError('INVALID_OPTION_VALUE', 'Empty option in debridoptions list');
      }
      for (const o of optList) {
        if (!ALLOWED_DEBRID_OPTIONS.has(o as TorrentioDebridOption)) {
          throw new TorrentioConfigError('INVALID_OPTION_VALUE', `Unsupported debrid option: "${o}"`);
        }
      }
      publicConfig.debridOptions = Array.from(new Set(optList)) as TorrentioDebridOption[];
    } else {
      throw new TorrentioConfigError('UNKNOWN_OPTION', `Unknown configuration option: "${key}"`);
    }
  }

  // Enforce debrid provider invariants
  if (foundDebridKeys.length === 0) {
    throw new TorrentioConfigError('MISSING_CREDENTIAL', 'A valid Real-Debrid credential is required');
  }

  if (foundDebridKeys.length > 1) {
    throw new TorrentioConfigError('MULTIPLE_CREDENTIALS', 'Multiple debrid provider credentials are not supported');
  }

  if (foundDebridKeys[0] !== 'realdebrid') {
    throw new TorrentioConfigError(
      'UNSUPPORTED_CREDENTIAL',
      `Unsupported debrid provider: "${foundDebridKeys[0]}". Only Real-Debrid is supported in this configuration.`
    );
  }

  if (!credential) {
    throw new TorrentioConfigError('MISSING_CREDENTIAL', 'A valid Real-Debrid credential is required');
  }

  return {
    provider: 'torrentio',
    publicConfig,
    credential,
  };
}
