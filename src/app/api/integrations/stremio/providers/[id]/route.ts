import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { deleteUserStremioConfig } from "@/features/stremio-switch/server/service.ts";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/integrations/stremio/providers/[id]
 * Deletes a Stremio provider configuration owned by the authenticated session user.
 */
export async function DELETE(
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
    const deleted = await deleteUserStremioConfig(session.user.id, id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Configuration not found or not owned by user." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete Stremio provider configuration:", err);
    return NextResponse.json(
      { error: "Failed to delete configuration." },
      { status: 500 }
    );
  }
}
