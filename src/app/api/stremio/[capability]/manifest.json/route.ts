import { NextRequest, NextResponse } from "next/server";
import {
  CORS_HEADERS,
  handleManifestRequest,
  ProxyError,
} from "@/features/stremio-switch/server/proxy";

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<Response> {
  try {
    const { capability } = await params;
    return await handleManifestRequest(capability);
  } catch (err) {
    if (err instanceof ProxyError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode, headers: CORS_HEADERS }
      );
    }
    console.error("[Stremio Proxy] Unexpected error in manifest route handler");
    return NextResponse.json(
      { error: "Internal capability proxy error." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
