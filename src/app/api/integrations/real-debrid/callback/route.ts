import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth/server";
import { exchangeCodeForTokens } from "@/features/real-debrid/server/oauth";
import { saveRealDebridConnection } from "@/features/real-debrid/server/connection";

export const dynamic = "force-dynamic";

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
  // 1. Ensure authenticated Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  const storedState = request.cookies.get("rd_oauth_state")?.value;

  // Prepare redirect base
  const redirectUrl = new URL("/modules/real-debrid", request.url);

  // Helper to create redirect response and clear OAuth state cookie
  function redirectWithCookieCleared(url: URL) {
    const res = NextResponse.redirect(url);
    res.cookies.set("rd_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/real-debrid",
      maxAge: 0,
    });
    return res;
  }

  // 2. Validate state presence and timing-safe equality
  if (!state || !storedState || !safeCompare(state, storedState)) {
    redirectUrl.searchParams.set("error", "invalid_state");
    return redirectWithCookieCleared(redirectUrl);
  }

  // 3. Check for upstream provider errors or missing code
  if (providerError || !code) {
    redirectUrl.searchParams.set("error", "provider_rejected");
    return redirectWithCookieCleared(redirectUrl);
  }

  // 4. Server-side token exchange and persistence
  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveRealDebridConnection(session.user.id, tokens);
    redirectUrl.searchParams.set("success", "connected");
    return redirectWithCookieCleared(redirectUrl);
  } catch (err) {
    console.error("Real-Debrid OAuth callback failed:", err instanceof Error ? err.message : "Unknown error");
    redirectUrl.searchParams.set("error", "exchange_failed");
    return redirectWithCookieCleared(redirectUrl);
  }
}
