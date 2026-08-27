import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import {
  checkDeviceCredentials,
  exchangeDeviceCodeForTokens,
} from "@/features/real-debrid/server/oauth";
import { decryptToken } from "@/features/real-debrid/server/encryption";
import { saveRealDebridConnection } from "@/features/real-debrid/server/connection";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Ensure authenticated Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Read encrypted device code from cookie
  const encryptedCookie = request.cookies.get("rd_device_code")?.value;
  if (!encryptedCookie) {
    return NextResponse.json({ status: "expired" });
  }

  let deviceCode: string;
  try {
    deviceCode = decryptToken(encryptedCookie);
  } catch {
    const res = NextResponse.json({ status: "expired" });
    res.cookies.set("rd_device_code", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/real-debrid",
      maxAge: 0,
    });
    return res;
  }

  // 3. Check credentials status with Real-Debrid provider
  const result = await checkDeviceCredentials(deviceCode);

  if (result === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  if (result === "expired") {
    const res = NextResponse.json({ status: "expired" });
    res.cookies.set("rd_device_code", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/real-debrid",
      maxAge: 0,
    });
    return res;
  }

  // 4. Authorized: Exchange credentials for tokens and persist
  try {
    const tokens = await exchangeDeviceCodeForTokens({
      clientId: result.client_id,
      clientSecret: result.client_secret,
      deviceCode,
    });

    await saveRealDebridConnection({
      userId: session.user.id,
      tokens,
      clientId: result.client_id,
      clientSecret: result.client_secret,
    });

    const res = NextResponse.json({ status: "connected" });
    // Clear temporary device code cookie
    res.cookies.set("rd_device_code", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/real-debrid",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error("Token exchange failed:", err instanceof Error ? err.message : "Unknown error");
    const res = NextResponse.json(
      { status: "error", message: "Failed to exchange authorized credentials." },
      { status: 500 }
    );
    res.cookies.set("rd_device_code", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/real-debrid",
      maxAge: 0,
    });
    return res;
  }
}
