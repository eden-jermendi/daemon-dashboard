import "server-only";
import {
  RealDebridDeviceCodeResponse,
  RealDebridDeviceCredentialsResponse,
  RealDebridTokenResponse,
} from "./types";

/**
 * Public Client ID published in Real-Debrid's official documentation
 * specifically for open-source applications (scopes: unrestrict, torrents, downloads, user).
 */
export const REAL_DEBRID_OPEN_SOURCE_CLIENT_ID = "X245A4XAIBGVM";

const REAL_DEBRID_DEVICE_CODE_URL = "https://api.real-debrid.com/oauth/v2/device/code";
const REAL_DEBRID_DEVICE_CREDENTIALS_URL = "https://api.real-debrid.com/oauth/v2/device/credentials";
const REAL_DEBRID_TOKEN_URL = "https://api.real-debrid.com/oauth/v2/token";
const REAL_DEBRID_DISABLE_TOKEN_URL = "https://api.real-debrid.com/rest/1.0/disable_access_token";

const REQUEST_TIMEOUT_MS = 10_000;
const REVOKE_TIMEOUT_MS = 5_000;

/**
 * Step 1: Initiates device authorization by requesting a device_code and user_code
 * from Real-Debrid with new_credentials=yes.
 */
export async function requestDeviceCode(): Promise<RealDebridDeviceCodeResponse> {
  const url = new URL(REAL_DEBRID_DEVICE_CODE_URL);
  url.searchParams.set("client_id", REAL_DEBRID_OPEN_SOURCE_CLIENT_ID);
  url.searchParams.set("new_credentials", "yes");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const message = err instanceof Error && err.name === "TimeoutError"
      ? "Real-Debrid device authorization request timed out."
      : "Network error during Real-Debrid device code request.";
    throw new Error(message);
  }

  if (!response.ok) {
    throw new Error(`Real-Debrid device code request rejected with HTTP ${response.status}`);
  }

  const data = (await response.json()) as Partial<RealDebridDeviceCodeResponse>;

  if (
    !data ||
    typeof data.device_code !== "string" ||
    typeof data.user_code !== "string" ||
    typeof data.verification_url !== "string"
  ) {
    throw new Error("Malformed device authorization response from Real-Debrid.");
  }

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    interval: typeof data.interval === "number" ? data.interval : 5,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : 1800,
    verification_url: data.direct_verification_url || data.verification_url,
  };
}

/**
 * Step 2: Checks if the user has authorized the device code.
 * Returns credentials if authorized, "pending" if still waiting, or "expired".
 */
export async function checkDeviceCredentials(
  deviceCode: string
): Promise<RealDebridDeviceCredentialsResponse | "pending" | "expired"> {
  if (!deviceCode) {
    return "expired";
  }

  const url = new URL(REAL_DEBRID_DEVICE_CREDENTIALS_URL);
  url.searchParams.set("client_id", REAL_DEBRID_OPEN_SOURCE_CLIENT_ID);
  url.searchParams.set("code", deviceCode.trim());

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // On temporary network hiccup, treat as pending to let polling retry
    return "pending";
  }

  if (response.ok) {
    const data = (await response.json()) as Partial<RealDebridDeviceCredentialsResponse>;
    if (
      data &&
      typeof data.client_id === "string" &&
      typeof data.client_secret === "string"
    ) {
      return {
        client_id: data.client_id,
        client_secret: data.client_secret,
      };
    }
  }

  // Handle provider pending vs expired status codes
  // Real-Debrid typically returns 400 or 403 while pending authorization
  if (response.status === 404 || response.status === 410) {
    return "expired";
  }

  return "pending";
}

/**
 * Step 3: Exchanges the device_code and generated user-bound client credentials for OAuth tokens.
 */
export async function exchangeDeviceCodeForTokens(params: {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
}): Promise<RealDebridTokenResponse> {
  const { clientId, clientSecret, deviceCode } = params;

  if (!clientId || !clientSecret || !deviceCode) {
    throw new Error("Missing credentials required for token exchange.");
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code: deviceCode.trim(),
    grant_type: "http://oauth.net/grant_type/device/1.0",
  });

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
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
      // Non-JSON response
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
 * Refreshes an expired Real-Debrid access token using stored user-bound client credentials
 * and stored refresh token via the documented device grant.
 */
export async function refreshRealDebridTokens(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<RealDebridTokenResponse> {
  const { clientId, clientSecret, refreshToken } = params;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing client credentials or refresh token for token refresh.");
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code: refreshToken.trim(),
    grant_type: "http://oauth.net/grant_type/device/1.0",
  });

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
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
    refresh_token: data.refresh_token || refreshToken,
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
