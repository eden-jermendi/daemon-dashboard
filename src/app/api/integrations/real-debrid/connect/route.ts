import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { requestDeviceCode } from "@/features/real-debrid/server/oauth";
import { encryptToken } from "@/features/real-debrid/server/encryption";

export const dynamic = "force-dynamic";

export async function POST() {
  // 1. Ensure authenticated Neon Auth session
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Request new device code from Real-Debrid
  try {
    const deviceData = await requestDeviceCode();

    // Encrypt the temporary device code for safe cookie storage
    const encryptedDeviceCode = encryptToken(deviceData.device_code);

    const response = NextResponse.json({
      user_code: deviceData.user_code,
      interval: deviceData.interval,
      expires_in: deviceData.expires_in,
      verification_url: deviceData.verification_url,
    });

    // 3. Store encrypted device code in short-lived HttpOnly SameSite=Lax cookie
    response.cookies.set("rd_device_code", encryptedDeviceCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/real-debrid",
      maxAge: deviceData.expires_in,
    });

    return response;
  } catch (err) {
    console.error("Real-Debrid device code request failed:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to initiate Real-Debrid authorization." },
      { status: 502 }
    );
  }
}
