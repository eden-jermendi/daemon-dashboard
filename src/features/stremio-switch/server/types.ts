import type { TorrentioPublicConfig } from "../domain/torrentio/types.ts";

export type StremioProviderName = "torrentio";

/**
 * Raw database record model from stremio_provider_configs.
 * Contains no credentials.
 */
export interface StremioProviderConfigRecord {
  id: string;
  user_id: string;
  provider_name: string;
  public_config: TorrentioPublicConfig;
  proxy_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Safe public DTO returned to client/management boundaries.
 * Explicitly excludes user_id and contains no credential secrets.
 */
export interface StremioProviderConfigDto {
  id: string;
  providerName: string;
  publicConfig: TorrentioPublicConfig;
  proxyId: string;
  createdAt: string;
  updatedAt: string;
  isConfigured: boolean;
}

export interface SaveStremioProviderConfigInput {
  userId: string;
  providerName: StremioProviderName;
  publicConfig: TorrentioPublicConfig;
}

export interface ImportTorrentioUrlInput {
  userId: string;
  url: string;
}
