import { TORRENTIO_ORIGIN } from "./constants.ts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SafeResolverData {
  infoHash: string;
  torrentId: string;
  fileIdx: string;
  filename?: string;
}

export interface TorrentioStreamItem {
  name?: string;
  title?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  behaviorHints?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TorrentioStreamResponse {
  streams?: TorrentioStreamItem[];
  [key: string]: unknown;
}

/**
 * Validates whether a given string is a valid UUID format (v4).
 */
export function isValidProxyId(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

/**
 * Validates whether a redirect hostname belongs strictly to the approved Real-Debrid CDN domain.
 * Permits *.download.real-debrid.com and download.real-debrid.com.
 */
export function isAllowedCdnHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== "string") {
    return false;
  }
  const lower = hostname.toLowerCase();
  return (
    lower === "download.real-debrid.com" ||
    lower.endsWith(".download.real-debrid.com")
  );
}

/**
 * Safely sanitizes error messages by scrubbing URLs, tokens, and credential material.
 */
export function sanitizeErrorMessage(err: unknown, tokenToScrub?: string): string {
  let message = err instanceof Error ? err.message : String(err);

  message = message.replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_URL]");

  if (tokenToScrub && tokenToScrub.length > 5) {
    message = message.replaceAll(tokenToScrub, "[REDACTED_TOKEN]");
  }

  message = message.replace(/[a-zA-Z0-9_-]{32,}/g, "[REDACTED]");

  return message;
}

/**
 * Parses and strictly validates a Torrentio Real-Debrid resolver URL.
 * Immediately discards any upstream token and extracts only safe, non-secret path data:
 * /resolve/realdebrid/<TOKEN>/<infoHash>/<torrentId>/<fileIdx>/<filename?>
 */
export function parseTorrentioResolverUrl(rawUrl: string): SafeResolverData | null {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "torrentio.strem.fun" ||
    (parsed.port && parsed.port !== "443")
  ) {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 6 || segments.length > 7) {
    return null;
  }

  if (segments[0] !== "resolve" || segments[1] !== "realdebrid") {
    return null;
  }

  const token = segments[2];
  if (!token || token.length < 10) {
    return null;
  }

  const infoHash = segments[3];
  if (!/^[a-fA-F0-9]{40}$/.test(infoHash)) {
    return null;
  }

  const torrentId = segments[4];
  if (!/^(null|[a-zA-Z0-9_-]{1,64})$/.test(torrentId)) {
    return null;
  }

  const fileIdx = segments[5];
  if (!/^(null|[0-9]{1,6})$/.test(fileIdx)) {
    return null;
  }

  let filename: string | undefined;
  if (segments.length === 7) {
    try {
      filename = decodeURIComponent(segments[6]);
    } catch {
      filename = segments[6];
    }
    if (
      filename.length > 500 ||
      filename.includes("\0") ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return null;
    }
  }

  return {
    infoHash: infoHash.toLowerCase(),
    torrentId,
    fileIdx,
    ...(filename ? { filename } : {}),
  };
}

/**
 * Validates path segments passed to Daemon's safe resolver endpoint.
 * Segments: [infoHash, torrentId, fileIdx, filename?]
 */
export function validateResolverSegments(segments: string[]): SafeResolverData | null {
  if (!Array.isArray(segments) || segments.length < 3 || segments.length > 4) {
    return null;
  }

  const [infoHash, torrentId, fileIdx, maybeFilename] = segments;

  if (!infoHash || !/^[a-fA-F0-9]{40}$/.test(infoHash)) {
    return null;
  }

  if (!torrentId || !/^(null|[a-zA-Z0-9_-]{1,64})$/.test(torrentId)) {
    return null;
  }

  if (!fileIdx || !/^(null|[0-9]{1,6})$/.test(fileIdx)) {
    return null;
  }

  let filename: string | undefined;
  if (maybeFilename !== undefined) {
    try {
      filename = decodeURIComponent(maybeFilename);
    } catch {
      filename = maybeFilename;
    }
    if (
      filename.length > 500 ||
      filename.includes("\0") ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return null;
    }
  }

  return {
    infoHash: infoHash.toLowerCase(),
    torrentId,
    fileIdx,
    ...(filename ? { filename } : {}),
  };
}

/**
 * Reconstructs the exact upstream Torrentio resolver URL in memory using a fresh OAuth token.
 */
export function reconstructTorrentioResolverUrl(
  token: string,
  data: SafeResolverData
): string {
  if (
    !token ||
    typeof token !== "string" ||
    token.includes("/") ||
    token.includes("..")
  ) {
    throw new Error("Invalid token for resolver reconstruction.");
  }

  const base = `${TORRENTIO_ORIGIN}/resolve/realdebrid/${token}/${data.infoHash}/${data.torrentId}/${data.fileIdx}`;
  return data.filename ? `${base}/${encodeURIComponent(data.filename)}` : base;
}

/**
 * Rewrites all credential-bearing Torrentio resolver URLs in stream JSON to safe Daemon capability URLs.
 * Fails closed on any unparseable resolver URL (omitting the entry).
 */
export function rewriteTorrentioStreamResponse(
  data: unknown,
  proxyId: string,
  baseUrl: string
): TorrentioStreamResponse {
  if (!data || typeof data !== "object") {
    return { streams: [] };
  }

  const response = data as TorrentioStreamResponse;
  if (!Array.isArray(response.streams)) {
    return { ...response, streams: [] };
  }

  const rewrittenStreams: TorrentioStreamItem[] = [];

  for (const stream of response.streams) {
    if (!stream || typeof stream !== "object") {
      continue;
    }

    if (!stream.url) {
      // Non-URL stream (e.g. standard P2P infoHash/fileIdx); safe to preserve
      rewrittenStreams.push({ ...stream });
      continue;
    }

    // Check if URL is a Torrentio resolver URL
    if (stream.url.includes("/resolve/realdebrid/")) {
      const parsed = parseTorrentioResolverUrl(stream.url);
      if (!parsed) {
        // FAIL CLOSED: Cannot safely parse credential-bearing URL, omit stream
        continue;
      }

      const pathSuffix = parsed.filename
        ? `${parsed.infoHash}/${parsed.torrentId}/${parsed.fileIdx}/${encodeURIComponent(parsed.filename)}`
        : `${parsed.infoHash}/${parsed.torrentId}/${parsed.fileIdx}`;

      const safeUrl = `${baseUrl}/api/stremio/${proxyId}/resolve/${pathSuffix}`;

      rewrittenStreams.push({
        ...stream,
        url: safeUrl,
      });
    } else {
      // If an external URL mentions realdebrid, fail closed
      if (stream.url.toLowerCase().includes("realdebrid")) {
        continue;
      }
      rewrittenStreams.push({ ...stream });
    }
  }

  return {
    ...response,
    streams: rewrittenStreams,
  };
}
