import "server-only";
import { getDb, isDbConfigured } from "@/lib/db";
import type {
  SaveStremioProviderConfigInput,
  StremioProviderConfigRecord,
} from "./types.ts";

/**
 * Retrieves all Stremio provider configurations owned by the user.
 */
export async function getUserStremioConfigs(
  userId: string
): Promise<StremioProviderConfigRecord[]> {
  if (!isDbConfigured || !userId) {
    return [];
  }

  const sql = getDb();
  const rows = await sql`
    SELECT 
      id,
      user_id,
      provider_name,
      public_config,
      proxy_id,
      created_at,
      updated_at
    FROM stremio_provider_configs
    WHERE user_id = ${userId}
    ORDER BY created_at ASC;
  `;

  return rows as unknown as StremioProviderConfigRecord[];
}

/**
 * Retrieves a single Stremio provider configuration for a user by provider name.
 */
export async function getUserStremioConfig(
  userId: string,
  providerName: string
): Promise<StremioProviderConfigRecord | null> {
  if (!isDbConfigured || !userId) {
    return null;
  }

  const sql = getDb();
  const rows = await sql`
    SELECT 
      id,
      user_id,
      provider_name,
      public_config,
      proxy_id,
      created_at,
      updated_at
    FROM stremio_provider_configs
    WHERE user_id = ${userId} AND provider_name = ${providerName}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as unknown as StremioProviderConfigRecord;
}

/**
 * Retrieves a single Stremio provider configuration by record ID with ownership check.
 */
export async function getUserStremioConfigById(
  userId: string,
  id: string
): Promise<StremioProviderConfigRecord | null> {
  if (!isDbConfigured || !userId || !id) {
    return null;
  }

  const sql = getDb();
  const rows = await sql`
    SELECT 
      id,
      user_id,
      provider_name,
      public_config,
      proxy_id,
      created_at,
      updated_at
    FROM stremio_provider_configs
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as unknown as StremioProviderConfigRecord;
}

/**
 * Upserts a Stremio provider configuration for a user.
 * Preserves the existing unguessable proxy_id on updates to avoid breaking installed Stremio add-ons.
 */
export async function upsertStremioConfig(
  input: SaveStremioProviderConfigInput
): Promise<StremioProviderConfigRecord> {
  if (!isDbConfigured) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = getDb();
  const serializedConfig = JSON.stringify(input.publicConfig);

  const rows = await sql`
    INSERT INTO stremio_provider_configs (
      user_id,
      provider_name,
      public_config,
      updated_at
    ) VALUES (
      ${input.userId},
      ${input.providerName},
      ${serializedConfig}::jsonb,
      NOW()
    )
    ON CONFLICT (user_id, provider_name) DO UPDATE SET
      public_config = EXCLUDED.public_config,
      updated_at = NOW()
    RETURNING 
      id,
      user_id,
      provider_name,
      public_config,
      proxy_id,
      created_at,
      updated_at;
  `;

  return rows[0] as unknown as StremioProviderConfigRecord;
}

/**
 * Deletes a user's Stremio provider configuration by ID with strict user ownership enforcement.
 */
export async function deleteUserStremioConfig(
  userId: string,
  id: string
): Promise<boolean> {
  if (!isDbConfigured || !userId || !id) {
    return false;
  }

  const sql = getDb();
  const rows = await sql`
    DELETE FROM stremio_provider_configs
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id;
  `;

  return rows.length > 0;
}

/**
 * Internal capability lookup by proxy_id for the future public proxy (Milestone 6D).
 * Kept strictly server-internal in Milestone 6C.
 */
export async function getStremioConfigByProxyIdInternal(
  proxyId: string
): Promise<StremioProviderConfigRecord | null> {
  if (!isDbConfigured || !proxyId) {
    return null;
  }

  const sql = getDb();
  const rows = await sql`
    SELECT 
      id,
      user_id,
      provider_name,
      public_config,
      proxy_id,
      created_at,
      updated_at
    FROM stremio_provider_configs
    WHERE proxy_id = ${proxyId}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as unknown as StremioProviderConfigRecord;
}
