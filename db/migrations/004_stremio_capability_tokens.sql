-- Migration: 004_stremio_capability_tokens.sql
-- Description: Replace plaintext proxy_id UUID with SHA-256 capability_hash and non-secret capability_hint

-- Drop proxy_id index and unique constraint
DROP INDEX IF EXISTS idx_stremio_provider_configs_proxy_id;
ALTER TABLE stremio_provider_configs DROP CONSTRAINT IF EXISTS uq_stremio_provider_configs_proxy_id;

-- Drop the plaintext proxy_id column completely
ALTER TABLE stremio_provider_configs DROP COLUMN IF EXISTS proxy_id;

-- Add capability_hash and capability_hint columns
ALTER TABLE stremio_provider_configs
    ADD COLUMN IF NOT EXISTS capability_hash VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS capability_hint VARCHAR(16);

-- Unique index for fast constant-time lookup on capability_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_stremio_provider_configs_capability_hash
    ON stremio_provider_configs (capability_hash)
    WHERE capability_hash IS NOT NULL;
