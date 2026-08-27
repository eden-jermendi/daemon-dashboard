import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth/server";
import { buildRealDebridAuthUrl, getRealDebridConfig } from "@/features/real-debrid/server/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Ensure authenticated Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // 2. Verify configuration
  const config = getRealDebridConfig();
  if (!config.isConfigured) {
    const errorUrl = new URL("/modules/real-debrid?error=not_configured", request.url);
    return NextResponse.redirect(errorUrl);
  }

  // 3. Generate cryptographically secure random state
  const state = randomBytes(32).toString("hex");

  // 4. Build authorization URL
  const authUrl = buildRealDebridAuthUrl(state);

  const response = NextResponse.redirect(authUrl);

  // 5. Store state in short-lived HttpOnly SameSite=Lax cookie
  response.cookies.set("rd_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/real-debrid",
    maxAge: 600, // 10 minutes
  });

  return response;
}
