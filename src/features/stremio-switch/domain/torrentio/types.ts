export type TorrentioSort = 'quality' | 'qualitysize' | 'seeders' | 'size';

export type TorrentioDebridOption = 'nodownloadlinks' | 'nocatalog';

export interface TorrentioPublicConfig {
  providers?: string[];
  sort?: TorrentioSort;
  priorityLanguages?: string[];
  qualityFilters?: string[];
  limit?: number;
  sizeFilter?: string;
  debridOptions?: TorrentioDebridOption[];
}

export interface RealDebridCredential {
  kind: 'realdebrid';
  secret: string;
}

export interface ValidatedTorrentioConfig {
  provider: 'torrentio';
  publicConfig: TorrentioPublicConfig;
  credential: RealDebridCredential;
}

export interface RedactedTorrentioConfig {
  provider: 'torrentio';
  publicConfig: TorrentioPublicConfig;
  credential: {
    kind: 'realdebrid';
    isConfigured: true;
  };
}
