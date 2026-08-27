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
