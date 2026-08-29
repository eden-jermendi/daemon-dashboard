import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import {
  getRealDebridTorrentInfo,
  deleteRealDebridTorrent,
} from "@/features/real-debrid/server/torrents";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  // 1. Authenticate with Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Invalid torrent ID." }, { status: 400 });
  }

  try {
    const torrent = await getRealDebridTorrentInfo({
      userId: session.user.id,
      id: id.trim(),
    });

    return NextResponse.json({ success: true, torrent });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch torrent info.";
    console.error("Real-Debrid torrent info failed:", errorMessage);

    const isAuthError =
      errorMessage.includes("reconnect") ||
      errorMessage.includes("connected") ||
      errorMessage.includes("authorization");
    const isPremiumError = errorMessage.includes("Premium");
    const isNotFound = errorMessage.includes("not found");
    const isUnavailable = errorMessage.includes("unavailable");

    const status = isAuthError ? 401 : isPremiumError ? 403 : isNotFound ? 404 : isUnavailable ? 503 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  // 1. Authenticate with Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Invalid torrent ID." }, { status: 400 });
  }

  try {
    const result = await deleteRealDebridTorrent({
      userId: session.user.id,
      id: id.trim(),
    });

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to delete torrent.";
    console.error("Real-Debrid delete torrent failed:", errorMessage);

    const isAuthError =
      errorMessage.includes("reconnect") ||
      errorMessage.includes("connected") ||
      errorMessage.includes("authorization");
    const isUnavailable = errorMessage.includes("unavailable");

    const status = isAuthError ? 401 : isUnavailable ? 503 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
