import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { checkRealDebridLink } from "@/features/real-debrid/server/links";

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

  // 3. Execute link check against Real-Debrid API
  try {
    const result = await checkRealDebridLink({
      link: link.trim(),
      password: safePassword,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Real-Debrid link check failed:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to check link with provider." },
      { status: 502 }
    );
  }
}
