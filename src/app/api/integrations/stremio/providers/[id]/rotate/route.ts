import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { rotateStremioCapability } from "@/features/stremio-switch/server/service.ts";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/integrations/stremio/providers/[id]/rotate
 * Rotates the capability token for a provider config.
 * Generates high-entropy token, persists ONLY SHA-256 hash, and returns
 * the plaintext capability exactly once to the caller.
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Configuration ID is required." },
      { status: 400 }
    );
  }

  try {
    const result = await rotateStremioCapability(session.user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rotate capability.";
    if (message.includes("not found") || message.includes("unauthorized")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Failed to rotate Stremio capability:", err);
    return NextResponse.json(
      { error: "Failed to rotate capability." },
      { status: 500 }
    );
  }
}
