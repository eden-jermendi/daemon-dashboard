import { REAL_DEBRID_TOKEN_REGEX } from './constants.ts';
import { TorrentioConfigError } from './errors.ts';
import type {
  RealDebridCredential,
  RedactedTorrentioConfig,
  TorrentioPublicConfig,
  ValidatedTorrentioConfig,
} from './types.ts';

const FORBIDDEN_VALUE_CHARS = /[|=\x00-\x1F\x7F]/;

function assertSafeValue(key: string, value: string): void {
  if (FORBIDDEN_VALUE_CHARS.test(value)) {
    throw new TorrentioConfigError(
      'INVALID_OPTION_VALUE',
      `Configuration value for "${key}" contains invalid delimiter or control characters`
    );
  }
}

/**
 * Serializes non-secret Torrentio options into canonical key=value pairs.
 */
function buildPublicPairs(publicConfig: TorrentioPublicConfig): [string, string][] {
  const pairs: [string, string][] = [];

  if (publicConfig.providers && publicConfig.providers.length > 0) {
    const val = publicConfig.providers.join(',');
    assertSafeValue('providers', val);
    pairs.push(['providers', val]);
  }

  if (publicConfig.sort && publicConfig.sort !== 'quality') {
    assertSafeValue('sort', publicConfig.sort);
    pairs.push(['sort', publicConfig.sort]);
  }

  if (publicConfig.priorityLanguages && publicConfig.priorityLanguages.length > 0) {
    const val = publicConfig.priorityLanguages.join(',');
    assertSafeValue('language', val);
    pairs.push(['language', val]);
  }

  if (publicConfig.qualityFilters && publicConfig.qualityFilters.length > 0) {
    const val = publicConfig.qualityFilters.join(',');
    assertSafeValue('qualityfilter', val);
    pairs.push(['qualityfilter', val]);
  }

  if (typeof publicConfig.limit === 'number' && publicConfig.limit > 0) {
    const val = String(publicConfig.limit);
    assertSafeValue('limit', val);
    pairs.push(['limit', val]);
  }

  if (publicConfig.sizeFilter && publicConfig.sizeFilter.length > 0) {
    assertSafeValue('sizefilter', publicConfig.sizeFilter);
    pairs.push(['sizefilter', publicConfig.sizeFilter]);
  }

  if (publicConfig.debridOptions && publicConfig.debridOptions.length > 0) {
    const val = publicConfig.debridOptions.join(',');
    assertSafeValue('debridoptions', val);
    pairs.push(['debridoptions', val]);
  }

  return pairs;
}

/**
 * Reconstructs the canonical Torrentio configuration segment for upstream requests,
 * containing the validated options and the Real-Debrid credential in deterministic order.
 */
export function serializeTorrentioConfig(config: ValidatedTorrentioConfig): string {
  if (
    !config ||
    !config.credential ||
    config.credential.kind !== 'realdebrid' ||
    typeof config.credential.secret !== 'string' ||
    !REAL_DEBRID_TOKEN_REGEX.test(config.credential.secret)
  ) {
    throw new TorrentioConfigError(
      'INVALID_CREDENTIAL',
      'Invalid Real-Debrid credential in configuration object'
    );
  }

  const pairs = buildPublicPairs(config.publicConfig || {});

  // Append the credential as the final pair
  pairs.push(['realdebrid', config.credential.secret]);

  return pairs.map(([k, v]) => `${k}=${v}`).join('|');
}

/**
 * Reconstructs the canonical Torrentio configuration segment by combining a public
 * configuration with a runtime Real-Debrid credential or raw token.
 */
export function serializeTorrentioConfigWithCredential(
  publicConfig: TorrentioPublicConfig,
  credential: RealDebridCredential | string
): string {
  const secret = typeof credential === 'string' ? credential : credential?.secret;
  return serializeTorrentioConfig({
    provider: 'torrentio',
    publicConfig: publicConfig || {},
    credential: {
      kind: 'realdebrid',
      secret,
    },
  });
}

/**
 * Serializes only the non-secret Torrentio options into a pipe-delimited segment.
 * Contains no credential.
 */
export function serializeTorrentioPublicConfig(
  config: ValidatedTorrentioConfig | TorrentioPublicConfig
): string {
  if (!config) {
    return '';
  }
  const publicConfig = 'publicConfig' in config ? config.publicConfig : config;
  const pairs = buildPublicPairs(publicConfig || {});
  return pairs.map(([k, v]) => `${k}=${v}`).join('|');
}

/**
 * Produces a safe, redacted representation of the configuration suitable for
 * client-side display or logging, omitting any credential secrets.
 */
export function toRedactedTorrentioConfig(
  config: ValidatedTorrentioConfig
): RedactedTorrentioConfig {
  if (
    !config ||
    !config.credential ||
    config.credential.kind !== 'realdebrid' ||
    typeof config.credential.secret !== 'string' ||
    !REAL_DEBRID_TOKEN_REGEX.test(config.credential.secret)
  ) {
    throw new TorrentioConfigError(
      'INVALID_CREDENTIAL',
      'Invalid Real-Debrid credential in configuration object'
    );
  }

  const publicConfig = config.publicConfig || {};
  return {
    provider: 'torrentio',
    publicConfig: {
      ...(publicConfig.providers ? { providers: [...publicConfig.providers] } : {}),
      ...(publicConfig.sort ? { sort: publicConfig.sort } : {}),
      ...(publicConfig.priorityLanguages
        ? { priorityLanguages: [...publicConfig.priorityLanguages] }
        : {}),
      ...(publicConfig.qualityFilters
        ? { qualityFilters: [...publicConfig.qualityFilters] }
        : {}),
      ...(typeof publicConfig.limit === 'number' ? { limit: publicConfig.limit } : {}),
      ...(publicConfig.sizeFilter ? { sizeFilter: publicConfig.sizeFilter } : {}),
      ...(publicConfig.debridOptions
        ? { debridOptions: [...publicConfig.debridOptions] }
        : {}),
    },
    credential: {
      kind: 'realdebrid',
      isConfigured: true,
    },
  };
}
