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

export interface ProviderConnectionRecord {
  id: string;
  user_id: string;
  provider: string;
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
