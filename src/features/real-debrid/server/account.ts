import "server-only";
import { cache } from "react";
import { getValidRealDebridAccessToken } from "./connection";
import { RealDebridAccount, RealDebridAccountResult } from "./types";

const REAL_DEBRID_USER_URL = "https://api.real-debrid.com/rest/1.0/user";
const USER_REQUEST_TIMEOUT_MS = 10_000;

const SHORT_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

/**
 * Defensively normalizes the raw Real-Debrid GET /user response into an application model.
 * Intentionally omits email, avatar, locale, and provider user ID for privacy.
 */
export function normalizeRealDebridUserResponse(data: unknown): RealDebridAccount {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid Real-Debrid user response: expected object.");
  }

  const record = data as Record<string, unknown>;

  const username = typeof record.username === "string" && record.username.trim()
    ? record.username.trim()
    : "Unknown User";

  const isPremium = record.type === "premium";
  const accountType = isPremium ? "premium" : "free";

  const premiumRemainingSeconds = typeof record.premium === "number" && !isNaN(record.premium)
    ? Math.max(0, Math.floor(record.premium))
    : 0;

  let expiration: Date | null = null;
  if (typeof record.expiration === "string" && record.expiration.trim()) {
    const parsedDate = new Date(record.expiration);
    if (!isNaN(parsedDate.getTime())) {
      expiration = parsedDate;
    }
  }

  const fidelityPoints = typeof record.points === "number" && !isNaN(record.points)
    ? Math.max(0, Math.floor(record.points))
    : 0;

  return {
    username,
    accountType,
    isPremium,
    premiumRemainingSeconds,
    expiration,
    fidelityPoints,
  };
}

/**
 * Formats remaining premium duration into a clean, human-readable string.
 */
export function formatPremiumRemaining(seconds: number): string {
  if (seconds <= 0) {
    return "Expired";
  }

  const SECONDS_PER_DAY = 86400;
  const SECONDS_PER_HOUR = 3600;
  const SECONDS_PER_MINUTE = 60;

  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    return days === 1 ? "1 day" : `${days} days`;
  }

  if (seconds >= SECONDS_PER_HOUR) {
    const hours = Math.floor(seconds / SECONDS_PER_HOUR);
    const mins = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const mins = Math.max(1, Math.floor(seconds / SECONDS_PER_MINUTE));
  return `${mins}m`;
}

/**
 * Formats an expiration date strictly complying with project DD-MM-YYYY format.
 */
export function formatExpirationDate(
  date: Date | null,
  style: "full" | "short" = "full"
): string {
  if (!date || isNaN(date.getTime())) {
    return "N/A";
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  if (style === "short") {
    const shortMonth = SHORT_MONTHS[date.getMonth()] || month;
    return `${day} ${shortMonth} ${year}`;
  }

  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  const secs = date.getSeconds().toString().padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
}

/**
 * Obtains live Real-Debrid account status for the given Daemon user.
 * Automatically handles token refresh via getValidRealDebridAccessToken.
 * Wrapped in React cache() for request-scoped deduplication.
 */
export const getRealDebridAccount = cache(
  async (userId: string | null | undefined): Promise<RealDebridAccountResult> => {
  if (!userId) {
    return { status: "disconnected" };
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidRealDebridAccessToken(userId);
  } catch (err) {
    console.error("Failed to obtain valid access token for Real-Debrid account check:", err);
    return {
      status: "error",
      error: "auth_invalid",
      message: "Authorization token invalid or expired. Reconnection required.",
    };
  }

  if (!accessToken) {
    return { status: "disconnected" };
  }

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_USER_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(USER_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const message = err instanceof Error && err.name === "TimeoutError"
      ? "Real-Debrid /user request timed out."
      : "Network error during Real-Debrid account retrieval.";
    console.error(message);
    return {
      status: "error",
      error: "api_unavailable",
      message: "Provider temporarily unavailable.",
    };
  }

  if (response.status === 401) {
    return {
      status: "error",
      error: "auth_invalid",
      message: "Real-Debrid authorization was revoked or expired.",
    };
  }

  if (response.status === 403) {
    return {
      status: "error",
      error: "account_locked",
      message: "Real-Debrid account is locked or restricted.",
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      error: "api_unavailable",
      message: `Real-Debrid API returned status ${response.status}.`,
    };
  }

  try {
    const rawData = await response.json();
    const account = normalizeRealDebridUserResponse(rawData);
    return {
      status: "connected",
      account,
    };
  } catch (err) {
    console.error("Failed to parse Real-Debrid user response:", err);
    return {
      status: "error",
      error: "unknown",
      message: "Malformed response received from provider.",
    };
  }
});
