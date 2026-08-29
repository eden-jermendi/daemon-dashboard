import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { selectRealDebridTorrentFiles } from "@/features/real-debrid/server/torrents";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  // 1. Authenticate with Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Invalid torrent ID." }, { status: 400 });
  }

  // 2. Parse JSON body
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
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { files } = body as { files?: (number | string)[] | "all" };

  if (files === undefined || files === null) {
    return NextResponse.json(
      { error: "A valid 'files' parameter (array of file IDs or 'all') is required." },
      { status: 400 }
    );
  }

  try {
    const result = await selectRealDebridTorrentFiles({
      userId: session.user.id,
      id: id.trim(),
      fileIds: files,
    });

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to select torrent files.";
    console.error("Real-Debrid file selection failed:", errorMessage);

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
