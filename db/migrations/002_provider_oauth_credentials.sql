-- Migration: 002_provider_oauth_credentials.sql
-- Description: Add encrypted_client_id and encrypted_client_secret columns for user-bound open-source OAuth credentials

ALTER TABLE provider_connections
ADD COLUMN IF NOT EXISTS encrypted_client_id TEXT,
ADD COLUMN IF NOT EXISTS encrypted_client_secret TEXT;
