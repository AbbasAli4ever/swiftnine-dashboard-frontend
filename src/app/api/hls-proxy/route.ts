import { NextRequest, NextResponse } from "next/server";

// Local-dev only proxy — bypasses CloudFront CORS by making the HLS request
// server-side. In production, VideoPlayer uses the manifestUrl directly.
// Only allowed hosts can be proxied to prevent open-proxy abuse.

const ALLOWED_HOSTS = ["cdn.swiftnine.com", "dplwj98ci797.cloudfront.net"];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const upstream = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!upstream.ok) {
    return new NextResponse(`Upstream error: ${upstream.status}`, {
      status: upstream.status,
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const body = await upstream.text();

  // Rewrite any absolute URLs inside .m3u8 playlists so sub-playlists
  // and segments also flow through this proxy
  const rewritten = body.replace(
    /^(https?:\/\/[^\s]+)$/gm,
    (match) => `/api/hls-proxy?url=${encodeURIComponent(match)}`
  );

  return new NextResponse(rewritten, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
