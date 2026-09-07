-- Migration: 003_stremio_provider_configs.sql
-- Description: Create stremio_provider_configs table for persisting public addon configurations and capability proxy IDs

CREATE TABLE IF NOT EXISTS stremio_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    public_config JSONB NOT NULL,
    proxy_id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stremio_provider_configs_user_provider UNIQUE (user_id, provider_name),
    CONSTRAINT uq_stremio_provider_configs_proxy_id UNIQUE (proxy_id)
);

CREATE INDEX IF NOT EXISTS idx_stremio_provider_configs_user 
    ON stremio_provider_configs (user_id);

CREATE INDEX IF NOT EXISTS idx_stremio_provider_configs_proxy_id 
    ON stremio_provider_configs (proxy_id);
