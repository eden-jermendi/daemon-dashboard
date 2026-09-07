import "server-only";
import { TORRENTIO_ORIGIN } from "../domain/torrentio/constants.ts";
import { serializeTorrentioConfigWithCredential } from "../domain/torrentio/serializer.ts";
import type { TorrentioPublicConfig } from "../domain/torrentio/types.ts";
import { getTorrentioRealDebridCredential } from "./real-debrid-credential.ts";
import { findConfigByCapabilityToken } from "./service.ts";

const UPSTREAM_REQUEST_TIMEOUT_MS = 10_000;

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

import {
  formatCapabilityHint,
  generateStremioCapability,
  hashStremioCapability,
  isAllowedCdnHost,
  isValidCapabilityToken,
  isValidProxyId,
  parseTorrentioResolverUrl,
  reconstructTorrentioResolverUrl,
  rewriteTorrentioStreamResponse,
  SafeResolverData,
  sanitizeErrorMessage,
  TorrentioStreamItem,
  TorrentioStreamResponse,
  validateResolverSegments,
} from "../domain/torrentio/index.ts";

export {
  formatCapabilityHint,
  generateStremioCapability,
  hashStremioCapability,
  isAllowedCdnHost,
  isValidCapabilityToken,
  isValidProxyId,
  parseTorrentioResolverUrl,
  reconstructTorrentioResolverUrl,
  rewriteTorrentioStreamResponse,
  sanitizeErrorMessage,
  validateResolverSegments,
};

export type {
  SafeResolverData,
  TorrentioStreamItem,
  TorrentioStreamResponse,
};

export class ProxyError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ProxyError";
  }
}

export interface ProxyDependencies {
  findConfig?: (
    capability: string
  ) => Promise<{ user_id: string; public_config: TorrentioPublicConfig } | null>;
  getCredential?: (userId: string) => Promise<{ secret: string } | null>;
  fetchFn?: typeof fetch;
}

/**
 * Resolves a capability token to its database configuration record and fresh RD OAuth token.
 * Rejects invalid format or unknown capability with generic 404.
 */
async function resolveCapabilityAndCredential(
  capability: string,
  deps?: ProxyDependencies
): Promise<{
  config: { user_id: string; public_config: TorrentioPublicConfig };
  token: string;
}> {
  if (!isValidCapabilityToken(capability)) {
    throw new ProxyError(404, "Unknown addon capability.");
  }

  const config = deps?.findConfig
    ? await deps.findConfig(capability)
    : await findConfigByCapabilityToken(capability);

  if (!config) {
    throw new ProxyError(404, "Unknown addon capability.");
  }

  const credential = deps?.getCredential
    ? await deps.getCredential(config.user_id)
    : await getTorrentioRealDebridCredential(config.user_id);

  if (!credential || !credential.secret) {
    throw new ProxyError(503, "Real-Debrid connection unavailable.");
  }

  return { config, token: credential.secret };
}

/**
 * Handles GET /api/stremio/[capability]/manifest.json
 */
export async function handleManifestRequest(
  capability: string,
  deps?: ProxyDependencies
): Promise<Response> {
  const { config, token } = await resolveCapabilityAndCredential(capability, deps);

  const segment = serializeTorrentioConfigWithCredential(
    config.public_config,
    token
  );
  const upstreamUrl = `${TORRENTIO_ORIGIN}/${segment}/manifest.json`;
  const fetchFn = deps?.fetchFn || fetch;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetchFn(upstreamUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Audit: Never log the capability token or complete addon URL
    console.error("[Stremio Proxy] Upstream manifest fetch failed.");
    throw new ProxyError(
      502,
      "Torrentio temporarily unavailable: " + sanitizeErrorMessage(err, token)
    );
  }

  if (!upstreamRes.ok) {
    throw new ProxyError(
      upstreamRes.status >= 500 ? 502 : upstreamRes.status,
      "Torrentio upstream manifest returned an error."
    );
  }

  const data = await upstreamRes.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ...CORS_HEADERS,
    },
  });
}

const SUPPORTED_STREAM_TYPES = new Set(["movie", "series", "anime", "other"]);
const SAFE_ID_REGEX = /^[a-zA-Z0-9:_-]{1,128}$/;

/**
 * Handles GET /api/stremio/[capability]/stream/[type]/[id]
 */
export async function handleStreamRequest(
  params: {
    capability?: string;
    proxyId?: string;
    type: string;
    idParam: string;
    baseUrl: string;
  },
  deps?: ProxyDependencies
): Promise<Response> {
  const capability = params.capability ?? params.proxyId ?? "";
  const { type, idParam, baseUrl } = params;

  if (!isValidCapabilityToken(capability)) {
    throw new ProxyError(404, "Unknown addon capability.");
  }

  if (!SUPPORTED_STREAM_TYPES.has(type)) {
    return new Response(JSON.stringify({ streams: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!idParam.endsWith(".json")) {
    throw new ProxyError(404, "Invalid stream request format: expected .json");
  }

  const rawId = idParam.slice(0, -5);
  if (!SAFE_ID_REGEX.test(rawId)) {
    return new Response(JSON.stringify({ streams: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { config, token } = await resolveCapabilityAndCredential(capability, deps);

  const segment = serializeTorrentioConfigWithCredential(
    config.public_config,
    token
  );
  const upstreamUrl = `${TORRENTIO_ORIGIN}/${segment}/stream/${type}/${rawId}.json`;
  const fetchFn = deps?.fetchFn || fetch;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetchFn(upstreamUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Audit: Never log the capability token or complete addon URL
    console.error("[Stremio Proxy] Upstream stream fetch failed.");
    throw new ProxyError(
      502,
      "Torrentio temporarily unavailable: " + sanitizeErrorMessage(err, token)
    );
  }

  if (!upstreamRes.ok) {
    throw new ProxyError(
      upstreamRes.status >= 500 ? 502 : upstreamRes.status,
      "Torrentio upstream streams returned an error."
    );
  }

  const upstreamData = await upstreamRes.json();
  const rewritten = rewriteTorrentioStreamResponse(upstreamData, capability, baseUrl);

  return new Response(JSON.stringify(rewritten), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handles GET /api/stremio/[capability]/resolve/[...resolverPath]
 */
export async function handleResolveRequest(
  params: {
    capability?: string;
    proxyId?: string;
    resolverSegments: string[];
  },
  deps?: ProxyDependencies
): Promise<Response> {
  const capability = params.capability ?? params.proxyId ?? "";
  const { resolverSegments } = params;

  if (!isValidCapabilityToken(capability)) {
    throw new ProxyError(404, "Unknown addon capability.");
  }

  const safeData = validateResolverSegments(resolverSegments);
  if (!safeData) {
    throw new ProxyError(400, "Invalid resolver path parameters.");
  }

  const { token } = await resolveCapabilityAndCredential(capability, deps);

  const upstreamUrl = reconstructTorrentioResolverUrl(token, safeData);
  const fetchFn = deps?.fetchFn || fetch;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetchFn(upstreamUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Audit: Never log the capability token or complete addon URL
    console.error("[Stremio Proxy] Upstream resolver fetch failed.");
    throw new ProxyError(
      502,
      "Torrentio temporarily unavailable: " + sanitizeErrorMessage(err, token)
    );
  }

  const location = upstreamRes.headers.get("location");

  if (!location) {
    throw new ProxyError(502, "Upstream resolver did not provide a redirect location.");
  }

  let locUrl: URL;
  try {
    locUrl = new URL(location);
  } catch {
    throw new ProxyError(502, "Invalid upstream redirect location format.");
  }

  // Intercept known Torrentio failure video redirect
  if (
    locUrl.hostname === "torrentio.strem.fun" &&
    locUrl.pathname.startsWith("/videos/")
  ) {
    throw new ProxyError(503, "Real-Debrid stream resolution failed.");
  }

  // Strictly enforce allowed Real-Debrid CDN destination
  if (locUrl.protocol !== "https:" || !isAllowedCdnHost(locUrl.hostname)) {
    throw new ProxyError(502, "Invalid upstream redirect target.");
  }

  // Return safe redirect to final Real-Debrid CDN destination
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...CORS_HEADERS,
    },
  });
}
