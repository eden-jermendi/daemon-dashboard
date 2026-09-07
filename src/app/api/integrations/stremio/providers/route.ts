import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import {
  importTorrentioConfigFromUrl,
  listUserStremioConfigs,
  saveTorrentioPublicConfig,
} from "@/features/stremio-switch/server/service.ts";
import { TorrentioConfigError } from "@/features/stremio-switch/domain/torrentio/errors.ts";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/stremio/providers
 * Returns all Stremio provider configurations owned by the authenticated session user.
 */
export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configs = await listUserStremioConfigs(session.user.id);
    return NextResponse.json({ providers: configs });
  } catch (err) {
    console.error("Failed to list Stremio provider configs:", err);
    return NextResponse.json(
      { error: "Failed to retrieve provider configurations." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/stremio/providers
 * Creates or updates a Stremio provider configuration.
 *
 * Supports two payload shapes:
 * 1. { provider: "torrentio", url: "https://torrentio.strem.fun/..." }
 *    Parses options and STRICTLY DISCARDS any embedded provider credentials.
 * 2. { provider: "torrentio", publicConfig: { ... } }
 *    Validates structured public options against the domain engine.
 */
export async function POST(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be an object." },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const provider = typeof record.provider === "string" ? record.provider.trim().toLowerCase() : "";

  if (provider !== "torrentio") {
    return NextResponse.json(
      { error: "Unsupported provider. Only 'torrentio' is supported." },
      { status: 400 }
    );
  }

  try {
    // Mode 1: Import full Torrentio URL (credential is extracted and discarded)
    if (typeof record.url === "string" && record.url.trim()) {
      const result = await importTorrentioConfigFromUrl({
        userId: session.user.id,
        url: record.url.trim(),
      });
      return NextResponse.json(result);
    }

    // Mode 2: Save structured public configuration
    if (record.publicConfig && typeof record.publicConfig === "object") {
      const result = await saveTorrentioPublicConfig({
        userId: session.user.id,
        publicConfig: record.publicConfig,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Either 'url' or 'publicConfig' must be provided." },
      { status: 400 }
    );
  } catch (err: unknown) {
    if (err instanceof TorrentioConfigError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    console.error("Failed to save Stremio provider configuration:", err);
    return NextResponse.json(
      { error: "Failed to save configuration." },
      { status: 500 }
    );
  }
}
