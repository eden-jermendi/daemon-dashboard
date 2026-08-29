import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { addRealDebridMagnet } from "@/features/real-debrid/server/torrents";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Authenticate with Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Safely parse JSON request payload
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

  const { magnet } = body as { magnet?: string };

  if (typeof magnet !== "string" || !magnet.trim()) {
    return NextResponse.json(
      { error: "A valid 'magnet' parameter is required." },
      { status: 400 }
    );
  }

  // 3. Add magnet via Real-Debrid API using user-bound credentials
  try {
    const result = await addRealDebridMagnet({
      userId: session.user.id,
      magnet: magnet.trim(),
    });

    return NextResponse.json({
      success: true,
      id: result.id,
      uri: result.uri,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to add magnet.";
    console.error("Real-Debrid add magnet failed:", errorMessage);

    const isAuthError =
      errorMessage.includes("reconnect") ||
      errorMessage.includes("connected") ||
      errorMessage.includes("authorization");
    const isPremiumError = errorMessage.includes("Premium");
    const isUnavailable = errorMessage.includes("unavailable");

    const status = isAuthError ? 401 : isPremiumError ? 403 : isUnavailable ? 503 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
