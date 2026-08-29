import "server-only";
import { getValidRealDebridAccessToken } from "./connection";
import {
  RealDebridAddMagnetResult,
  RealDebridTorrentFile,
  RealDebridTorrentInfo,
  RealDebridTorrentStatus,
  RealDebridRawTorrentInfo,
  RealDebridRawAddMagnetResponse,
} from "./types";

const REAL_DEBRID_ADD_MAGNET_URL = "https://api.real-debrid.com/rest/1.0/torrents/addMagnet";
const REAL_DEBRID_TORRENT_INFO_URL = "https://api.real-debrid.com/rest/1.0/torrents/info";
const REAL_DEBRID_SELECT_FILES_URL = "https://api.real-debrid.com/rest/1.0/torrents/selectFiles";
const REAL_DEBRID_DELETE_TORRENT_URL = "https://api.real-debrid.com/rest/1.0/torrents/delete";
const TORRENT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Validates a BitTorrent magnet URI.
 * Requires non-empty string, valid magnet scheme, and at least one valid BitTorrent exact topic identifier (xt=urn:btih: or xt=urn:btmh:).
 * Avoids loose substring matching to prevent injection or invalid requests.
 */
export function validateMagnetUri(rawMagnet: string): {
  valid: boolean;
  normalizedMagnet?: string;
  error?: string;
} {
  if (!rawMagnet || typeof rawMagnet !== "string" || !rawMagnet.trim()) {
    return { valid: false, error: "Magnet URI is required." };
  }

  const trimmed = rawMagnet.trim();

  // Basic scheme check
  if (!trimmed.toLowerCase().startsWith("magnet:?")) {
    return {
      valid: false,
      error: "Invalid magnet URI format. Must begin with 'magnet:?'.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Malformed magnet URI syntax.",
    };
  }

  if (parsed.protocol !== "magnet:") {
    return {
      valid: false,
      error: `Unsupported protocol (${parsed.protocol}). Only 'magnet:' URIs are supported.`,
    };
  }

  // Check xt parameters
  const xtParams = parsed.searchParams.getAll("xt");
  if (!xtParams || xtParams.length === 0) {
    return {
      valid: false,
      error: "Magnet URI missing required 'xt' (exact topic) parameter.",
    };
  }

  const hasBtih = xtParams.some((xt) => {
    const lower = xt.toLowerCase();
    // SHA1 40-char hex, base32 32-char, or btmh multihash
    return (
      /^urn:btih:[a-f0-9]{40}$/i.test(lower) ||
      /^urn:btih:[a-z2-7]{32}$/i.test(lower) ||
      /^urn:btmh:[a-f0-9]+$/i.test(lower) ||
      /^urn:btih:[a-z0-9]+$/i.test(lower)
    );
  });

  if (!hasBtih) {
    return {
      valid: false,
      error: "Magnet URI does not contain a valid BitTorrent info hash (urn:btih or urn:btmh).",
    };
  }

  return { valid: true, normalizedMagnet: trimmed };
}

/**
 * Validates a torrent identifier string to prevent path traversal or malformed API calls.
 */
export function validateTorrentId(id: string): {
  valid: boolean;
  normalizedId?: string;
  error?: string;
} {
  if (!id || typeof id !== "string" || !id.trim()) {
    return { valid: false, error: "Torrent ID is required." };
  }

  const trimmed = id.trim();
  // Real-Debrid torrent IDs are typically alphanumeric (e.g. 6-12 chars or hex/base32)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: "Invalid torrent ID format." };
  }

  return { valid: true, normalizedId: trimmed };
}

/**
 * Maps raw provider status string into normalized RealDebridTorrentStatus.
 */
export function normalizeTorrentStatus(rawStatus?: string): {
  status: RealDebridTorrentStatus;
  rawStatus: string;
} {
  const raw = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "unknown";

  switch (raw) {
    case "magnet_conversion":
      return { status: "magnet_conversion", rawStatus: raw };
    case "waiting_files_selection":
      return { status: "waiting_files_selection", rawStatus: raw };
    case "queued":
      return { status: "queued", rawStatus: raw };
    case "downloading":
      return { status: "downloading", rawStatus: raw };
    case "downloaded":
      return { status: "downloaded", rawStatus: raw };
    case "compressing":
    case "uploading":
      return { status: "processing", rawStatus: raw };
    case "virus":
      return { status: "virus", rawStatus: raw };
    case "dead":
      return { status: "dead", rawStatus: raw };
    case "magnet_error":
    case "error":
      return { status: "error", rawStatus: raw };
    default:
      return { status: "error", rawStatus: raw };
  }
}

/**
 * Defensively normalizes Real-Debrid GET /torrents/info/{id} responses into the application model.
 */
export function normalizeTorrentInfo(data: unknown): RealDebridTorrentInfo {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Real-Debrid torrent info response: expected JSON object.");
  }

  const record = data as RealDebridRawTorrentInfo;

  if (typeof record.error === "string" && record.error.trim()) {
    const errorCode = typeof record.error_code === "number" ? record.error_code : null;
    let message = record.error;
    if (errorCode === 20) message = "This operation requires an active Real-Debrid Premium account.";
    else if (errorCode === 16) message = "Unsupported torrent or hoster.";
    throw new Error(message);
  }

  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "";
  if (!id) {
    throw new Error("Torrent info response is missing a valid ID.");
  }

  const filename = typeof record.filename === "string" && record.filename.trim()
    ? record.filename.trim()
    : "Unnamed Torrent";

  const originalFilename = typeof record.original_filename === "string" && record.original_filename.trim()
    ? record.original_filename.trim()
    : filename;

  const hash = typeof record.hash === "string" && record.hash.trim()
    ? record.hash.trim()
    : "";

  const bytes = typeof record.bytes === "number" && !isNaN(record.bytes) && record.bytes >= 0
    ? Math.floor(record.bytes)
    : 0;

  const originalBytes = typeof record.original_bytes === "number" && !isNaN(record.original_bytes) && record.original_bytes >= 0
    ? Math.floor(record.original_bytes)
    : bytes;

  const host = typeof record.host === "string" && record.host.trim()
    ? record.host.trim()
    : "real-debrid.com";

  const rawProgress = typeof record.progress === "number" && !isNaN(record.progress)
    ? record.progress
    : 0;
  const progress = Math.max(0, Math.min(100, Math.floor(rawProgress)));

  const { status, rawStatus } = normalizeTorrentStatus(record.status);

  const addedDate = typeof record.added === "string" && record.added.trim()
    ? record.added.trim()
    : null;

  const endedDate = typeof record.ended === "string" && record.ended.trim()
    ? record.ended.trim()
    : null;

  const speed = typeof record.speed === "number" && !isNaN(record.speed) && record.speed >= 0
    ? Math.floor(record.speed)
    : null;

  const seeders = typeof record.seeders === "number" && !isNaN(record.seeders) && record.seeders >= 0
    ? Math.floor(record.seeders)
    : null;

  const files: RealDebridTorrentFile[] = [];
  if (Array.isArray(record.files)) {
    for (const f of record.files) {
      if (f && typeof f === "object") {
        const fileId = typeof f.id === "number" ? f.id : parseInt(String(f.id), 10);
        if (!isNaN(fileId)) {
          files.push({
            id: fileId,
            path: typeof f.path === "string" ? f.path : `/file_${fileId}`,
            bytes: typeof f.bytes === "number" && f.bytes >= 0 ? Math.floor(f.bytes) : 0,
            selected: f.selected === 1 || f.selected === true,
          });
        }
      }
    }
  }

  const links: string[] = [];
  if (Array.isArray(record.links)) {
    for (const l of record.links) {
      if (typeof l === "string" && l.trim()) {
        links.push(l.trim());
      }
    }
  }

  return {
    id,
    filename,
    originalFilename,
    hash,
    bytes,
    originalBytes,
    host,
    progress,
    status,
    rawStatus,
    addedDate,
    endedDate,
    speed,
    seeders,
    files,
    links,
  };
}

/**
 * Adds a magnet link to Real-Debrid using POST /rest/1.0/torrents/addMagnet.
 * Requires an active Neon Auth user session with a connected Real-Debrid account.
 */
export async function addRealDebridMagnet(params: {
  userId: string;
  magnet: string;
  host?: string;
}): Promise<RealDebridAddMagnetResult> {
  const { userId, magnet, host } = params;

  const validation = validateMagnetUri(magnet);
  if (!validation.valid || !validation.normalizedMagnet) {
    throw new Error(validation.error || "Invalid magnet URI.");
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidRealDebridAccessToken(userId);
  } catch (err) {
    console.error("Failed to obtain valid access token for Real-Debrid addMagnet:", err);
    throw new Error("Authorization token invalid or expired. Reconnection required.");
  }

  if (!accessToken) {
    throw new Error("Real-Debrid is not connected. Please connect your account first.");
  }

  const formData = new URLSearchParams();
  formData.append("magnet", validation.normalizedMagnet);
  if (host && host.trim()) {
    formData.append("host", host.trim());
  }

  let response: Response;
  try {
    response = await fetch(REAL_DEBRID_ADD_MAGNET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(TORRENT_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new Error(
      isTimeout
        ? "Real-Debrid add magnet request timed out."
        : "Provider temporarily unavailable."
    );
  }

  if (response.status === 401) {
    throw new Error("Real-Debrid authorization invalid or revoked. Please reconnect.");
  }

  if (response.status === 403) {
    throw new Error("Real-Debrid Premium is required for torrent operations.");
  }

  if (response.status === 503) {
    throw new Error("Real-Debrid torrent service is temporarily unavailable.");
  }

  let rawData: unknown;
  try {
    rawData = await response.json();
  } catch {
    throw new Error(`Real-Debrid returned an invalid response (Status ${response.status}).`);
  }

  if (!response.ok) {
    if (rawData && typeof rawData === "object" && "error" in rawData) {
      const errObj = rawData as RealDebridRawAddMagnetResponse;
      if (errObj.error_code === 20) throw new Error("Real-Debrid Premium is required for torrent operations.");
      if (errObj.error_code === 16) throw new Error("Unsupported magnet link or hoster.");
      throw new Error(errObj.error || `Provider error (code: ${errObj.error_code}).`);
    }
    throw new Error(`Real-Debrid returned error status ${response.status}.`);
  }

  const record = rawData as RealDebridRawAddMagnetResponse;
  if (!record || typeof record.id !== "string" || !record.id.trim()) {
    throw new Error("Real-Debrid did not return a valid torrent ID.");
  }

  return {
    id: record.id.trim(),
    uri: typeof record.uri === "string" ? record.uri.trim() : "",
  };
}

/**
 * Retrieves torrent information and status using GET /rest/1.0/torrents/info/{id}.
 */
export async function getRealDebridTorrentInfo(params: {
  userId: string;
  id: string;
}): Promise<RealDebridTorrentInfo> {
  const { userId, id } = params;

  const validation = validateTorrentId(id);
  if (!validation.valid || !validation.normalizedId) {
    throw new Error(validation.error || "Invalid torrent ID.");
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidRealDebridAccessToken(userId);
  } catch (err) {
    console.error("Failed to obtain valid access token for Real-Debrid torrent info:", err);
    throw new Error("Authorization token invalid or expired. Reconnection required.");
  }

  if (!accessToken) {
    throw new Error("Real-Debrid is not connected. Please connect your account first.");
  }

  const url = `${REAL_DEBRID_TORRENT_INFO_URL}/${encodeURIComponent(validation.normalizedId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TORRENT_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new Error(
      isTimeout
        ? "Real-Debrid torrent info request timed out."
        : "Provider temporarily unavailable."
    );
  }

  if (response.status === 401) {
    throw new Error("Real-Debrid authorization invalid or revoked. Please reconnect.");
  }

  if (response.status === 403) {
    throw new Error("Real-Debrid Premium is required for torrent operations.");
  }

  if (response.status === 404) {
    throw new Error("Torrent not found on Real-Debrid or has been removed.");
  }

  if (response.status === 503) {
    throw new Error("Real-Debrid torrent service is temporarily unavailable.");
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
      throw new Error(errObj.error || `Provider error (code: ${errObj.error_code}).`);
    }
    throw new Error(`Real-Debrid returned error status ${response.status}.`);
  }

  return normalizeTorrentInfo(rawData);
}

/**
 * Selects files to start downloading a torrent using POST /rest/1.0/torrents/selectFiles/{id}.
 * Handles HTTP 204 (success) and HTTP 202 (action already done / idempotent).
 */
export async function selectRealDebridTorrentFiles(params: {
  userId: string;
  id: string;
  fileIds: (number | string)[] | "all";
}): Promise<{ success: boolean; message?: string }> {
  const { userId, id, fileIds } = params;

  const validation = validateTorrentId(id);
  if (!validation.valid || !validation.normalizedId) {
    throw new Error(validation.error || "Invalid torrent ID.");
  }

  let filesParam: string;
  if (fileIds === "all") {
    filesParam = "all";
  } else if (Array.isArray(fileIds)) {
    const validIds = fileIds
      .map((fid) => (typeof fid === "number" ? fid : parseInt(String(fid), 10)))
      .filter((fid) => !isNaN(fid) && fid >= 0);

    if (validIds.length === 0) {
      throw new Error("Please select at least one file to download.");
    }
    filesParam = validIds.join(",");
  } else {
    throw new Error("Invalid file selection parameter.");
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidRealDebridAccessToken(userId);
  } catch (err) {
    console.error("Failed to obtain valid access token for Real-Debrid selectFiles:", err);
    throw new Error("Authorization token invalid or expired. Reconnection required.");
  }

  if (!accessToken) {
    throw new Error("Real-Debrid is not connected. Please connect your account first.");
  }

  const url = `${REAL_DEBRID_SELECT_FILES_URL}/${encodeURIComponent(validation.normalizedId)}`;
  const formData = new URLSearchParams();
  formData.append("files", filesParam);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(TORRENT_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new Error(
      isTimeout
        ? "Real-Debrid file selection request timed out."
        : "Provider temporarily unavailable."
    );
  }

  // HTTP 204: Success (No Content)
  if (response.status === 204) {
    return { success: true };
  }

  // HTTP 202: Action already done (Idempotent success)
  if (response.status === 202) {
    return { success: true, message: "File selection already applied." };
  }

  if (response.status === 401) {
    throw new Error("Real-Debrid authorization invalid or revoked. Please reconnect.");
  }

  if (response.status === 403) {
    throw new Error("Real-Debrid Premium is required for torrent operations.");
  }

  if (response.status === 404) {
    throw new Error("Invalid file IDs or torrent not found on Real-Debrid.");
  }

  let rawData: unknown = null;
  try {
    const text = await response.text();
    if (text.trim()) {
      rawData = JSON.parse(text);
    }
  } catch {
    rawData = null;
  }

  if (rawData && typeof rawData === "object" && "error" in rawData) {
    const errObj = rawData as { error?: string; error_code?: number };
    throw new Error(errObj.error || `Provider error (code: ${errObj.error_code}).`);
  }

  throw new Error(`Real-Debrid returned error status ${response.status}.`);
}

/**
 * Removes/cancels a torrent using DELETE /rest/1.0/torrents/delete/{id}.
 * Safely handles HTTP 204 (deleted) and HTTP 404 (already deleted/not found).
 */
export async function deleteRealDebridTorrent(params: {
  userId: string;
  id: string;
}): Promise<{ success: boolean; message?: string }> {
  const { userId, id } = params;

  const validation = validateTorrentId(id);
  if (!validation.valid || !validation.normalizedId) {
    throw new Error(validation.error || "Invalid torrent ID.");
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidRealDebridAccessToken(userId);
  } catch (err) {
    console.error("Failed to obtain valid access token for Real-Debrid deleteTorrent:", err);
    throw new Error("Authorization token invalid or expired. Reconnection required.");
  }

  if (!accessToken) {
    throw new Error("Real-Debrid is not connected. Please connect your account first.");
  }

  const url = `${REAL_DEBRID_DELETE_TORRENT_URL}/${encodeURIComponent(validation.normalizedId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TORRENT_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new Error(
      isTimeout
        ? "Real-Debrid delete torrent request timed out."
        : "Provider temporarily unavailable."
    );
  }

  // HTTP 204: Success
  if (response.status === 204) {
    return { success: true };
  }

  // HTTP 404: Already removed / not found -> safe idempotent success
  if (response.status === 404) {
    return { success: true, message: "Torrent already removed or not found." };
  }

  if (response.status === 401) {
    throw new Error("Real-Debrid authorization invalid or revoked. Please reconnect.");
  }

  if (response.status === 403) {
    throw new Error("Permission denied by Real-Debrid.");
  }

  throw new Error(`Real-Debrid returned error status ${response.status}.`);
}
