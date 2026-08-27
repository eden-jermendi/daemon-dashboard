-- Migration: 001_provider_connections.sql
-- Description: Create provider_connections table for encrypted OAuth credentials

CREATE TABLE IF NOT EXISTS provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider_connections_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_connections_user_provider 
    ON provider_connections (user_id, provider);
