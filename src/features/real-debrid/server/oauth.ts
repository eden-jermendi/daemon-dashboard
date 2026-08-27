import "server-only";
import { RealDebridTokenResponse } from "./types";

const REAL_DEBRID_OAUTH_AUTH_URL = "https://api.real-debrid.com/oauth/v2/auth";
const REAL_DEBRID_OAUTH_TOKEN_URL = "https://api.real-debrid.com/oauth/v2/token";
const REAL_DEBRID_DISABLE_TOKEN_URL = "https://api.real-debrid.com/rest/1.0/disable_access_token";

const REQUEST_TIMEOUT_MS = 10_000;
const REVOKE_TIMEOUT_MS = 5_000;

export function getRealDebridConfig() {
  const clientId = process.env.REAL_DEBRID_CLIENT_ID;
  const clientSecret = process.env.REAL_DEBRID_CLIENT_SECRET;
  const redirectUri = process.env.REAL_DEBRID_REDIRECT_URI;

  return {
    clientId: clientId?.trim() ?? "",
    clientSecret: clientSecret?.trim() ?? "",
    redirectUri: redirectUri?.trim() ?? "",
    isConfigured: Boolean(clientId && clientSecret && redirectUri),
  };
}

/**
 * Builds the official 3-legged Real-Debrid OAuth authorization URL.
 */
export function buildRealDebridAuthUrl(state: string): string {
  const config = getRealDebridConfig();
  if (!config.isConfigured) {
    throw new Error(
      "Real-Debrid OAuth is not configured. Missing REAL_DEBRID_CLIENT_ID, REAL_DEBRID_CLIENT_SECRET, or REAL_DEBRID_REDIRECT_URI."
    );
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
  });

  return `${REAL_DEBRID_OAUTH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges an ephemeral OAuth authorization code for Real-Debrid tokens.
 * Strictly executed on the server.
 */
export async function exchangeCodeForTokens(code: string): Promise<RealDebridTokenResponse> {
  const config = getRealDebridConfig();
  if (!config.isConfigured) {
    throw new Error("Real-Debrid OAuth credentials not configured.");
  }

  if (!code || typeof code !== "string") {
    throw new Error("Missing or invalid authorization code.");
  }

  const bodyParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: code.trim(),
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const message = err instanceof Error && err.name === "TimeoutError"
      ? "Real-Debrid token exchange timed out."
      : "Network error during Real-Debrid token exchange.";
    throw new Error(message);
  }

  if (!response.ok) {
    let errorSummary = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson === "object" && "error" in errJson) {
        errorSummary = String(errJson.error);
      }
    } catch {
      // Non-JSON error response from upstream
    }
    throw new Error(`Real-Debrid token exchange rejected: ${errorSummary}`);
  }

  const data = (await response.json()) as Partial<RealDebridTokenResponse>;

  if (!data || typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    throw new Error("Malformed token response from Real-Debrid provider.");
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type || "Bearer",
    refresh_token: data.refresh_token,
  };
}

/**
 * Refreshes an expired Real-Debrid access token using the stored refresh token.
 * 
 * IMPORTANT: Real-Debrid's documented OAuth implementation uses a non-standard
 * device grant URI for token refreshes:
 * grant_type = "http://oauth.net/grant_type/device/1.0"
 * and passes the refresh token in the `code` parameter.
 * Do not replace with standard grant_type=refresh_token.
 */
export async function refreshRealDebridTokens(
  storedRefreshToken: string
): Promise<RealDebridTokenResponse> {
  const config = getRealDebridConfig();
  if (!config.isConfigured) {
    throw new Error("Real-Debrid OAuth credentials not configured.");
  }

  if (!storedRefreshToken || typeof storedRefreshToken !== "string") {
    throw new Error("Cannot refresh without a valid refresh token.");
  }

  const bodyParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: storedRefreshToken.trim(),
    grant_type: "http://oauth.net/grant_type/device/1.0",
  });

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const message = err instanceof Error && err.name === "TimeoutError"
      ? "Real-Debrid token refresh timed out."
      : "Network error during Real-Debrid token refresh.";
    throw new Error(message);
  }

  if (!response.ok) {
    let errorSummary = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson === "object" && "error" in errJson) {
        errorSummary = String(errJson.error);
      }
    } catch {
      // Non-JSON response
    }
    throw new Error(`Real-Debrid token refresh failed: ${errorSummary}`);
  }

  const data = (await response.json()) as Partial<RealDebridTokenResponse>;

  if (!data || typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    throw new Error("Malformed token refresh response from Real-Debrid provider.");
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type || "Bearer",
    refresh_token: data.refresh_token || storedRefreshToken,
  };
}

/**
 * Disables the current Real-Debrid access token (best-effort revocation).
 * Real-Debrid documentation specifies GET /rest/1.0/disable_access_token returning 204.
 */
export async function disableRealDebridAccessToken(accessToken: string): Promise<void> {
  if (!accessToken) return;

  try {
    await fetch(REAL_DEBRID_DISABLE_TOKEN_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
    });
  } catch {
    // Best-effort revocation: ignore network / timeout errors during disconnection
  }
}
