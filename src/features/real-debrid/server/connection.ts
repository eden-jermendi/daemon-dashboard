import "server-only";
import { cache } from "react";
import { getDb, isDbConfigured } from "@/lib/db";
import { encryptToken, decryptToken } from "./encryption";
import {
  refreshRealDebridTokens,
  disableRealDebridAccessToken,
} from "./oauth";
import {
  ProviderConnectionRecord,
  RealDebridConnectionStatus,
  RealDebridTokenResponse,
} from "./types";

const PROVIDER_NAME = "real-debrid";
const REFRESH_SAFETY_MARGIN_MS = 5 * 60 * 1000; // 5 minutes safety window

/**
 * Retrieves the raw provider connection record from Neon Postgres for a user.
 * Wrapped in React cache() for request-scoped memoization to eliminate duplicate DB round-trips.
 */
export const getRealDebridConnection = cache(
  async (userId: string): Promise<ProviderConnectionRecord | null> => {
  if (!isDbConfigured) {
    return null;
  }

  const sql = getDb();
  const rows = await sql`
    SELECT 
      id,
      user_id,
      provider,
      encrypted_client_id,
      encrypted_client_secret,
      encrypted_access_token,
      encrypted_refresh_token,
      token_type,
      access_token_expires_at,
      created_at,
      updated_at
    FROM provider_connections
    WHERE user_id = ${userId} AND provider = ${PROVIDER_NAME}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as unknown as ProviderConnectionRecord;
});

/**
 * Checks connection status without decrypting tokens.
 */
export async function getRealDebridConnectionStatus(
  userId: string | null | undefined
): Promise<RealDebridConnectionStatus> {
  if (!userId || !isDbConfigured) {
    return {
      isConfigured: isDbConfigured,
      isConnected: false,
      expiresAt: null,
      updatedAt: null,
    };
  }

  try {
    const connection = await getRealDebridConnection(userId);
    if (!connection) {
      return {
        isConfigured: isDbConfigured,
        isConnected: false,
        expiresAt: null,
        updatedAt: null,
      };
    }

    const expiresAt = connection.access_token_expires_at
      ? new Date(connection.access_token_expires_at)
      : null;
    const updatedAt = connection.updated_at
      ? new Date(connection.updated_at)
      : null;

    return {
      isConfigured: isDbConfigured,
      isConnected: true,
      expiresAt,
      updatedAt,
    };
  } catch (err) {
    console.error("Failed to query Real-Debrid connection status:", err);
    return {
      isConfigured: isDbConfigured,
      isConnected: false,
      expiresAt: null,
      updatedAt: null,
    };
  }
}

/**
 * Persists newly acquired or refreshed Real-Debrid tokens and generated credentials in encrypted format.
 */
export async function saveRealDebridConnection(params: {
  userId: string;
  tokens: RealDebridTokenResponse;
  clientId?: string;
  clientSecret?: string;
}): Promise<void> {
  const { userId, tokens, clientId, clientSecret } = params;

  if (!isDbConfigured) {
    throw new Error("Cannot save provider connection: DATABASE_URL is not configured.");
  }

  const sql = getDb();
  const encryptedAccessToken = encryptToken(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : "";

  const encryptedClientId = clientId ? encryptToken(clientId) : null;
  const encryptedClientSecret = clientSecret ? encryptToken(clientSecret) : null;

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await sql`
    INSERT INTO provider_connections (
      user_id,
      provider,
      encrypted_client_id,
      encrypted_client_secret,
      encrypted_access_token,
      encrypted_refresh_token,
      token_type,
      access_token_expires_at,
      updated_at
    ) VALUES (
      ${userId},
      ${PROVIDER_NAME},
      ${encryptedClientId},
      ${encryptedClientSecret},
      ${encryptedAccessToken},
      ${encryptedRefreshToken},
      ${tokens.token_type || "Bearer"},
      ${expiresAt.toISOString()},
      NOW()
    )
    ON CONFLICT (user_id, provider) DO UPDATE SET
      encrypted_client_id = COALESCE(EXCLUDED.encrypted_client_id, provider_connections.encrypted_client_id),
      encrypted_client_secret = COALESCE(EXCLUDED.encrypted_client_secret, provider_connections.encrypted_client_secret),
      encrypted_access_token = EXCLUDED.encrypted_access_token,
      encrypted_refresh_token = CASE 
        WHEN EXCLUDED.encrypted_refresh_token <> '' THEN EXCLUDED.encrypted_refresh_token 
        ELSE provider_connections.encrypted_refresh_token 
      END,
      token_type = EXCLUDED.token_type,
      access_token_expires_at = EXCLUDED.access_token_expires_at,
      updated_at = NOW();
  `;
}

/**
 * Disconnects Real-Debrid by best-effort disabling the access token upstream
 * and removing the encrypted credentials from the database.
 */
export async function deleteRealDebridConnection(userId: string): Promise<void> {
  if (!isDbConfigured) return;

  const sql = getDb();

  // Try best-effort upstream disable before deleting locally
  try {
    const connection = await getRealDebridConnection(userId);
    if (connection?.encrypted_access_token) {
      const accessToken = decryptToken(connection.encrypted_access_token);
      await disableRealDebridAccessToken(accessToken);
    }
  } catch {
    // Ignore decryption or network errors during revocation
  }

  await sql`
    DELETE FROM provider_connections
    WHERE user_id = ${userId} AND provider = ${PROVIDER_NAME};
  `;
}

/**
 * Obtains a valid, unexpired Real-Debrid access token for the given user.
 * If the cached access token is nearing expiration, automatically refreshes it
 * using the stored user-bound client credentials and documented device grant.
 */
export async function getValidRealDebridAccessToken(
  userId: string
): Promise<string | null> {
  const connection = await getRealDebridConnection(userId);
  if (!connection) {
    return null;
  }

  const expiresAt = new Date(connection.access_token_expires_at).getTime();
  const now = Date.now();

  // Return existing token if still valid beyond safety margin
  if (now + REFRESH_SAFETY_MARGIN_MS < expiresAt) {
    return decryptToken(connection.encrypted_access_token);
  }

  // Token is expired or expiring soon -> Refresh using stored generated client credentials
  if (!connection.encrypted_refresh_token) {
    throw new Error(
      "Real-Debrid access token is expired and no refresh token is stored. Please reconnect."
    );
  }

  if (!connection.encrypted_client_id || !connection.encrypted_client_secret) {
    throw new Error(
      "Real-Debrid OAuth client credentials are missing from stored connection. Please reconnect."
    );
  }

  const clientId = decryptToken(connection.encrypted_client_id);
  const clientSecret = decryptToken(connection.encrypted_client_secret);
  const storedRefreshToken = decryptToken(connection.encrypted_refresh_token);

  const newTokens = await refreshRealDebridTokens({
    clientId,
    clientSecret,
    refreshToken: storedRefreshToken,
  });

  await saveRealDebridConnection({
    userId,
    tokens: newTokens,
    clientId,
    clientSecret,
  });

  return newTokens.access_token;
}
