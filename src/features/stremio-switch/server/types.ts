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
  capability_hash: string | null;
  capability_hint: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Safe public DTO returned to client/management boundaries.
 * Explicitly excludes user_id, capability_hash, and contains no credential secrets.
 */
export interface StremioProviderConfigDto {
  id: string;
  providerName: string;
  publicConfig: TorrentioPublicConfig;
  capabilityConfigured: boolean;
  capabilityHint: string | null;
  createdAt: string;
  updatedAt: string;
  isConfigured: boolean;
}

export interface RotateCapabilityResult {
  capability: string;
  capabilityHint: string;
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
