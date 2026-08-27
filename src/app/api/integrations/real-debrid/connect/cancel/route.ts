import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST() {
  // 1. Ensure authenticated Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Clear temporary device code cookie
  const response = NextResponse.json({ status: "cancelled" });
  response.cookies.set("rd_device_code", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/real-debrid",
    maxAge: 0,
  });

  return response;
}
