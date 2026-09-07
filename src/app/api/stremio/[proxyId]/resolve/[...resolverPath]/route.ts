import { NextRequest, NextResponse } from "next/server";
import {
  CORS_HEADERS,
  handleResolveRequest,
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
  {
    params,
  }: {
    params: Promise<{ proxyId: string; resolverPath?: string[] }>;
  }
): Promise<Response> {
  try {
    const { proxyId, resolverPath } = await params;

    return await handleResolveRequest({
      proxyId,
      resolverSegments: resolverPath || [],
    });
  } catch (err) {
    if (err instanceof ProxyError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode, headers: CORS_HEADERS }
      );
    }
    console.error("[Stremio Proxy] Unexpected error in resolver route handler");
    return NextResponse.json(
      { error: "Internal capability proxy error." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
