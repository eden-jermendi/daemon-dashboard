import type { TorrentioDebridOption, TorrentioSort } from './types.ts';

export const TORRENTIO_ORIGIN = 'https://torrentio.strem.fun';
export const TORRENTIO_HOST = 'torrentio.strem.fun';

export const MAX_URL_LENGTH = 2048;
export const MAX_CONFIG_SEGMENT_LENGTH = 1024;
export const MAX_VALUE_LENGTH = 256;

export const ALLOWED_PROVIDERS: ReadonlySet<string> = new Set<string>([
  'yts',
  'eztv',
  'rarbg',
  '1337x',
  'ext',
  'thepiratebay',
  'kickasstorrents',
  'torrentgalaxy',
  'magnetdl',
  'horriblesubs',
  'nyaasi',
  'tokyotosho',
  'anidex',
  'nekobt',
  'rutor',
  'rutracker',
  'comando',
  'bludv',
  'micoleaodublado',
  'torrent9',
  'ilcorsaronero',
  'mejortorrent',
  'wolfmax4k',
  'cinecalidad',
  'besttorrents',
]);

export const ALLOWED_SORTS: ReadonlySet<TorrentioSort> = new Set<TorrentioSort>([
  'quality',
  'qualitysize',
  'seeders',
  'size',
]);

export const ALLOWED_LANGUAGES: ReadonlySet<string> = new Set<string>([
  'japanese',
  'russian',
  'italian',
  'portuguese',
  'spanish',
  'latino',
  'korean',
  'chinese',
  'taiwanese',
  'french',
  'german',
  'dutch',
  'hindi',
  'telugu',
  'tamil',
  'polish',
  'lithuanian',
  'latvian',
  'estonian',
  'czech',
  'slovakian',
  'slovenian',
  'hungarian',
  'romanian',
  'bulgarian',
  'serbian',
  'croatian',
  'ukrainian',
  'greek',
  'danish',
  'finnish',
  'swedish',
  'norwegian',
  'turkish',
  'arabic',
  'persian',
  'hebrew',
  'vietnamese',
  'indonesian',
  'malay',
  'thai',
]);

export const ALLOWED_QUALITIES: ReadonlySet<string> = new Set<string>([
  'brremux',
  'hdrall',
  'dolbyvision',
  'dolbyvisionwithhdr',
  'threed',
  'nonthreed',
  '4k',
  '1080p',
  '720p',
  '480p',
  'other',
  'scr',
  'cam',
  'unknown',
]);

export const ALLOWED_DEBRID_OPTIONS: ReadonlySet<TorrentioDebridOption> = new Set<TorrentioDebridOption>([
  'nodownloadlinks',
  'nocatalog',
]);

export const KNOWN_DEBRID_PROVIDERS: ReadonlySet<string> = new Set<string>([
  'premiumize',
  'alldebrid',
  'debridlink',
  'easydebrid',
  'offcloud',
  'torbox',
  'putio',
]);

export const KNOWN_PUBLIC_OPTION_KEYS: ReadonlySet<string> = new Set<string>([
  'providers',
  'sort',
  'language',
  'qualityfilter',
  'limit',
  'sizefilter',
  'debridoptions',
]);

export const REAL_DEBRID_TOKEN_REGEX = /^[a-zA-Z0-9_-]{16,128}$/;
export const LIMIT_REGEX = /^[1-9][0-9]{0,2}$/;
export const SIZE_FILTER_REGEX = /^[0-9]+(?:\.[0-9]+)?(?:B|KB|MB|GB|TB)(?:,[0-9]+(?:\.[0-9]+)?(?:B|KB|MB|GB|TB))?$/i;
