import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { deleteRealDebridConnection } from "@/features/real-debrid/server/connection";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Ensure authenticated Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // 2. Remove connection and revoke token upstream
  try {
    await deleteRealDebridConnection(session.user.id);
    const redirectUrl = new URL("/modules/real-debrid?success=disconnected", request.url);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  } catch (err) {
    console.error("Failed to disconnect Real-Debrid:", err instanceof Error ? err.message : "Unknown error");
    const redirectUrl = new URL("/modules/real-debrid?error=disconnect_failed", request.url);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }
}
