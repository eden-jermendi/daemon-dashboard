import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { unrestrictRealDebridLink } from "@/features/real-debrid/server/links";

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

  const { link, password } = body as { link?: string; password?: string };

  if (typeof link !== "string" || !link.trim()) {
    return NextResponse.json(
      { error: "A valid 'link' parameter is required." },
      { status: 400 }
    );
  }

  const safePassword = typeof password === "string" && password.trim()
    ? password.trim()
    : undefined;

  // 3. Execute link unrestriction against Real-Debrid API using user-bound credentials
  try {
    const result = await unrestrictRealDebridLink({
      userId: session.user.id,
      link: link.trim(),
      password: safePassword,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to unrestrict link.";
    console.error("Real-Debrid link unrestrict failed:", errorMessage);

    // Provide friendly, non-leaking status codes and messages
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
