import { NextRequest, NextResponse } from "next/server";
import {
  CORS_HEADERS,
  handleStreamRequest,
  ProxyError,
} from "@/features/stremio-switch/server/proxy";

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function resolveBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const proto = forwardedProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "http");

  return `${proto}://${host}`;
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ proxyId: string; type: string; id: string }>;
  }
): Promise<Response> {
  try {
    const { proxyId, type, id } = await params;
    const baseUrl = resolveBaseUrl(request);

    return await handleStreamRequest({
      proxyId,
      type,
      idParam: id,
      baseUrl,
    });
  } catch (err) {
    if (err instanceof ProxyError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode, headers: CORS_HEADERS }
      );
    }
    console.error("[Stremio Proxy] Unexpected error in stream route handler");
    return NextResponse.json(
      { error: "Internal capability proxy error." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
