import "server-only";
import { getValidRealDebridAccessToken } from "./connection";
import {
  RealDebridLinkCheckResult,
  UnrestrictedDownload,
  UnrestrictResult,
} from "./types";

const REAL_DEBRID_CHECK_URL = "https://api.real-debrid.com/rest/1.0/unrestrict/check";
const REAL_DEBRID_UNRESTRICT_URL = "https://api.real-debrid.com/rest/1.0/unrestrict/link";
const LINK_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Validates a user-supplied host URL.
 * Requires non-empty string, valid absolute URL, and HTTP/HTTPS protocol only.
 * Strictly avoids making direct outbound fetches to the target URL from Daemon Dashboard.
 */
export function validateLinkUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Link URL is required." };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format. Please enter a valid HTTP or HTTPS URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Unsupported protocol (${parsed.protocol}). Only HTTP and HTTPS URLs are supported.`,
    };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

import { formatBytes } from "@/lib/formatters";
export { formatBytes };

/**
 * Defensively normalizes Real-Debrid POST /unrestrict/check responses into the application model.
 */
export function normalizeCheckResponse(
  data: unknown,
  httpStatus: number,
  originalLink: string
): RealDebridLinkCheckResult {
  if (httpStatus === 503) {
    return {
      status: "file_unavailable",
      host: null,
      link: originalLink,
      filename: null,
      filesize: null,
      supported: false,
      message: "The provider reports that this file is currently unavailable.",
    };
  }

  if (!data || typeof data !== "object") {
    return {
      status: "error",
      host: null,
      link: originalLink,
      filename: null,
      filesize: null,
      supported: false,
      message: "Malformed response received from provider.",
    };
  }

  const record = data as Record<string, unknown>;

  // Check for error message or error_code in response
  if (typeof record.error === "string" && record.error.trim()) {
    const errorCode = typeof record.error_code === "number" ? record.error_code : null;
    let message = record.error;

    if (errorCode === 16) {
      return {
        status: "unsupported",
        host: typeof record.host === "string" ? record.host : null,
        link: originalLink,
        filename: null,
        filesize: null,
        supported: false,
        message: "Real-Debrid does not report this hoster or link as supported.",
      };
    }

    if (errorCode === 24 || record.error === "file_unavailable") {
      return {
        status: "file_unavailable",
        host: typeof record.host === "string" ? record.host : null,
        link: originalLink,
        filename: null,
        filesize: null,
        supported: false,
        message: "The provider reports that this file is currently unavailable.",
      };
    }

    if (errorCode === 13) {
      message = "Invalid host password provided.";
    } else if (errorCode === 17 || errorCode === 19) {
      message = "Hoster is temporarily unavailable or in maintenance.";
    } else if (errorCode === 20) {
      message = "This hoster requires an active Real-Debrid Premium account.";
    }

    return {
      status: "error",
      host: typeof record.host === "string" ? record.host : null,
      link: originalLink,
      filename: null,
      filesize: null,
      supported: false,
      message,
    };
  }

  const supportedNum = typeof record.supported === "number" ? record.supported : 0;
  const isSupported = supportedNum === 1;

  const host = typeof record.host === "string" && record.host.trim()
    ? record.host.trim()
    : null;

  const filename = typeof record.filename === "string" && record.filename.trim()
    ? record.filename.trim()
    : null;

  const rawFilesize = typeof record.filesize === "number" && !isNaN(record.filesize) && record.filesize > 0
    ? Math.floor(record.filesize)
    : null;

  return {
    status: isSupported ? "supported" : "unsupported",
    host,
    link: typeof record.link === "string" && record.link.trim() ? record.link.trim() : originalLink,
    filename,
    filesize: rawFilesize,
    supported: isSupported,
    message: isSupported
      ? undefined
      : "Real-Debrid does not report this link as supported.",
  };
}

function parseSingleDownloadItem(record: Record<string, unknown>): UnrestrictedDownload | null {
  const downloadUrl = typeof record.download === "string" && record.download.trim()
    ? record.download.trim()
    : "";

  if (!downloadUrl) {
    return null;
  }

  const id = typeof record.id === "string" && record.id.trim()
    ? record.id.trim()
    : `dl-${Date.now()}`;

  const filename = typeof record.filename === "string" && record.filename.trim()
    ? record.filename.trim()
    : "unrestricted_file";

  const rawFilesize = typeof record.filesize === "number" && !isNaN(record.filesize) && record.filesize > 0
    ? Math.floor(record.filesize)
    : null;

  const mimeType = typeof record.mimeType === "string" && record.mimeType.trim()
    ? record.mimeType.trim()
    : null;

  const host = typeof record.host === "string" && record.host.trim()
    ? record.host.trim()
    : "unknown";

  const streamable = record.streamable === 1 || record.streamable === true;

  const type = typeof record.type === "string" && record.type.trim()
    ? record.type.trim()
    : null;

  return {
    id,
    filename,
    filesize: rawFilesize,
    mimeType,
    host,
    downloadUrl,
    streamable,
    type,
  };
}

/**
 * Defensively normalizes Real-Debrid POST /unrestrict/link responses into the application collection model.
 * Handles single generated link objects, multiple stream/quality alternatives, and array responses.
 */
export function normalizeUnrestrictResponse(data: unknown): UnrestrictResult {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid Real-Debrid unrestrict response: expected object or array.");
  }

  const downloads: UnrestrictedDownload[] = [];

  // Case 1: Response is an array of download objects
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object") {
        const parsed = parseSingleDownloadItem(item as Record<string, unknown>);
        if (parsed) {
          downloads.push(parsed);
        }
      }
    }
  } else {
    const record = data as Record<string, unknown>;

    // Check if there is an error in the response object
    if (typeof record.error === "string" && record.error.trim()) {
      const errorCode = typeof record.error_code === "number" ? record.error_code : null;
      let message = record.error;
      if (errorCode === 13) message = "Invalid host password provided.";
      else if (errorCode === 16) message = "Unsupported hoster.";
      else if (errorCode === 20) message = "This hoster requires an active Real-Debrid Premium account.";
      else if (errorCode === 24 || record.error === "file_unavailable") message = "The source file is unavailable.";
      else if (errorCode === 23) message = "Real-Debrid traffic limit for this host has been exhausted.";
      throw new Error(message);
    }

    // Parse primary download object
    const primary = parseSingleDownloadItem(record);
    if (primary) {
      downloads.push(primary);
    }

    // Parse alternative downloads if present (e.g. YouTube qualities / multiple formats)
    if (Array.isArray(record.alternative)) {
      for (let i = 0; i < record.alternative.length; i++) {
        const alt = record.alternative[i];
        if (alt && typeof alt === "object") {
          const altRecord = alt as Record<string, unknown>;
          const downloadUrl = typeof altRecord.download === "string" ? altRecord.download.trim() : "";
          if (downloadUrl) {
            downloads.push({
              id: typeof altRecord.id === "string" && altRecord.id.trim()
                ? altRecord.id.trim()
                : `${primary?.id || "alt"}-${i + 1}`,
              filename: typeof altRecord.filename === "string" && altRecord.filename.trim()
                ? altRecord.filename.trim()
                : primary?.filename || "unrestricted_file",
              filesize: typeof altRecord.filesize === "number" && altRecord.filesize > 0
                ? Math.floor(altRecord.filesize)
                : primary?.filesize ?? null,
              mimeType: typeof altRecord.mimeType === "string" && altRecord.mimeType.trim()
                ? altRecord.mimeType.trim()
                : primary?.mimeType ?? null,
              host: primary?.host || (typeof record.host === "string" ? record.host : "unknown"),
              downloadUrl,
              streamable: primary?.streamable ?? false,
              type: typeof altRecord.type === "string" && altRecord.type.trim()
                ? altRecord.type.trim()
                : null,
            });
          }
        }
      }
    }
  }

  if (downloads.length === 0) {
    throw new Error("No valid download links returned from Real-Debrid.");
  }

  return { downloads };
}

/**
 * Checks a hoster link using Real-Debrid's POST /unrestrict/check endpoint.
 * Real-Debrid does not require authentication for this endpoint, but Daemon routes wrapping it do.
 */
export async function checkRealDebridLink(params: {
  link: string;
  password?: string;
}): Promise<RealDebridLinkCheckResult> {
  const validation = validateLinkUrl(params.link);
  if (!validation.valid || !validation.normalizedUrl) {
    return {
      status: "error",
      host: null,
      link: params.link,
      filename: null,
      filesize: null,
      supported: false,
      message: validation.error || "Invalid link URL.",
    };
  }

  const formData = new URLSearchParams();
  formData.append("link", validation.normalizedUrl);
  if (params.password && params.password.trim()) {
    formData.append("password", params.password.trim());
  }

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_CHECK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(LINK_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      status: "error",
      host: null,
      link: validation.normalizedUrl,
      filename: null,
      filesize: null,
      supported: false,
      message: isTimeout
        ? "Real-Debrid link check timed out."
        : "Provider temporarily unavailable.",
    };
  }

  let rawData: unknown = null;
  try {
    rawData = await response.json();
  } catch {
    // rawData remains null; normalizeCheckResponse will handle non-200 / 503 / null
  }

  return normalizeCheckResponse(rawData, response.status, validation.normalizedUrl);
}

/**
 * Unrestricts a hoster link using Real-Debrid's POST /unrestrict/link endpoint.
 * Requires an active Neon Auth user session with a connected Real-Debrid account.
 * Automatically refreshes expired Real-Debrid access tokens via getValidRealDebridAccessToken.
 */
export async function unrestrictRealDebridLink(params: {
  userId: string;
  link: string;
  password?: string;
}): Promise<UnrestrictResult> {
  const { userId, link, password } = params;

  const validation = validateLinkUrl(link);
  if (!validation.valid || !validation.normalizedUrl) {
    throw new Error(validation.error || "Invalid link URL.");
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidRealDebridAccessToken(userId);
  } catch (err) {
    console.error("Failed to obtain valid access token for Real-Debrid unrestrict:", err);
    throw new Error("Authorization token invalid or expired. Reconnection required.");
  }

  if (!accessToken) {
    throw new Error("Real-Debrid is not connected. Please connect your account first.");
  }

  const formData = new URLSearchParams();
  formData.append("link", validation.normalizedUrl);
  if (password && password.trim()) {
    formData.append("password", password.trim());
  }

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_UNRESTRICT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(LINK_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new Error(
      isTimeout
        ? "Real-Debrid link unrestriction timed out."
        : "Provider temporarily unavailable."
    );
  }

  if (response.status === 401) {
    throw new Error("Real-Debrid authorization invalid or revoked. Please reconnect.");
  }

  if (response.status === 403) {
    throw new Error("This operation requires an active Real-Debrid Premium account.");
  }

  if (response.status === 503) {
    throw new Error("The provider reports that this file is unavailable.");
  }

  let rawData: unknown;
  try {
    rawData = await response.json();
  } catch {
    throw new Error(`Real-Debrid returned an invalid response (Status ${response.status}).`);
  }

  if (!response.ok) {
    if (rawData && typeof rawData === "object" && "error" in rawData) {
      const errObj = rawData as { error?: string; error_code?: number };
      if (errObj.error_code === 13) throw new Error("Invalid host password provided.");
      if (errObj.error_code === 16) throw new Error("Unsupported hoster.");
      if (errObj.error_code === 20) throw new Error("This hoster requires an active Real-Debrid Premium account.");
      if (errObj.error_code === 23) throw new Error("Real-Debrid traffic limit for this host has been exhausted.");
      if (errObj.error_code === 24 || errObj.error === "file_unavailable") throw new Error("The source file is unavailable.");
      throw new Error(errObj.error || `Provider error (code: ${errObj.error_code}).`);
    }
    throw new Error(`Real-Debrid returned error status ${response.status}.`);
  }

  return normalizeUnrestrictResponse(rawData);
}
