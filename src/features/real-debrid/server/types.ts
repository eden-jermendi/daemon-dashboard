export type RealDebridAccountType = "premium" | "free";

export interface RealDebridAccount {
  username: string;
  accountType: RealDebridAccountType;
  isPremium: boolean;
  premiumRemainingSeconds: number;
  expiration: Date | null;
  fidelityPoints: number;
}

export type RealDebridAccountResult =
  | { status: "connected"; account: RealDebridAccount }
  | { status: "disconnected" }
  | {
      status: "error";
      error: "api_unavailable" | "auth_invalid" | "account_locked" | "unknown";
      message?: string;
    };

export interface RealDebridTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

export interface RealDebridTokenError {
  error: string;
  error_code?: number;
  error_details?: string;
}

export interface RealDebridDeviceCodeResponse {
  device_code: string;
  user_code: string;
  interval: number;
  expires_in: number;
  verification_url: string;
  direct_verification_url?: string;
}

export interface RealDebridDeviceCodeClientResponse {
  user_code: string;
  interval: number;
  expires_in: number;
  verification_url: string;
}

export interface RealDebridDeviceCredentialsResponse {
  client_id: string;
  client_secret: string;
}

export interface ProviderConnectionRecord {
  id: string;
  user_id: string;
  provider: string;
  encrypted_client_id?: string | null;
  encrypted_client_secret?: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_type: string;
  access_token_expires_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface RealDebridConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  expiresAt: Date | null;
  updatedAt: Date | null;
}

export type RealDebridLinkCheckStatus =
  | "supported"
  | "unsupported"
  | "file_unavailable"
  | "error";

export interface RealDebridLinkCheckResult {
  status: RealDebridLinkCheckStatus;
  host: string | null;
  link: string;
  filename: string | null;
  filesize: number | null;
  supported: boolean;
  message?: string;
}

export interface UnrestrictedDownload {
  id: string;
  filename: string;
  filesize: number | null;
  mimeType: string | null;
  host: string;
  downloadUrl: string;
  streamable: boolean;
  type?: string | null;
}

export interface UnrestrictResult {
  downloads: UnrestrictedDownload[];
}

export interface RealDebridCheckResponse {
  host?: string;
  link?: string;
  filename?: string;
  filesize?: number;
  supported?: number;
  error?: string;
  error_code?: number;
}

export interface RealDebridAlternativeLink {
  id?: string;
  filename?: string;
  download?: string;
  type?: string;
  filesize?: number;
  mimeType?: string;
}

export interface RealDebridUnrestrictLinkResponse {
  id?: string;
  filename?: string;
  mimeType?: string;
  filesize?: number;
  link?: string;
  host?: string;
  chunks?: number;
  crc?: number;
  download?: string;
  streamable?: number;
  type?: string;
  alternative?: RealDebridAlternativeLink[];
  error?: string;
  error_code?: number;
}

export type RealDebridTorrentStatus =
  | "magnet_conversion"
  | "waiting_files_selection"
  | "queued"
  | "downloading"
  | "downloaded"
  | "processing"
  | "error"
  | "virus"
  | "dead";

export interface RealDebridTorrentFile {
  id: number;
  path: string;
  bytes: number;
  selected: boolean;
}

export interface RealDebridTorrentInfo {
  id: string;
  filename: string;
  originalFilename: string;
  hash: string;
  bytes: number;
  originalBytes: number;
  host: string;
  progress: number;
  status: RealDebridTorrentStatus;
  rawStatus: string;
  addedDate: string | null;
  endedDate: string | null;
  speed: number | null;
  seeders: number | null;
  files: RealDebridTorrentFile[];
  links: string[];
}

export interface RealDebridAddMagnetResult {
  id: string;
  uri: string;
}

export interface RealDebridRawTorrentFile {
  id?: number | string;
  path?: string;
  bytes?: number;
  selected?: number | boolean;
}

export interface RealDebridRawTorrentInfo {
  id?: string;
  filename?: string;
  original_filename?: string;
  hash?: string;
  bytes?: number;
  original_bytes?: number;
  host?: string;
  split?: number;
  progress?: number;
  status?: string;
  added?: string;
  ended?: string;
  speed?: number;
  seeders?: number;
  files?: RealDebridRawTorrentFile[];
  links?: string[];
  error?: string;
  error_code?: number;
}

export interface RealDebridRawAddMagnetResponse {
  id?: string;
  uri?: string;
  error?: string;
  error_code?: number;
}
