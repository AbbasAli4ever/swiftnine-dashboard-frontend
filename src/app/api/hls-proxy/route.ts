import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function rewritePlaylist(playlist: string, sourceUrl: string) {
  const base = new URL(sourceUrl);

  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }

      const absolute = new URL(trimmed, base).toString();
      return `/api/hls-proxy?url=${encodeURIComponent(absolute)}`;
    })
    .join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');

    if (!url) {
      return new Response('Missing url', { status: 400 });
    }

    const upstream = await fetch(url, {
      headers: { Accept: '*/*' },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return new Response(await upstream.text(), { status: upstream.status });
    }

    const type = upstream.headers.get('content-type') || '';

    if (type.includes('application/vnd.apple.mpegurl') || url.endsWith('.m3u8')) {
      const text = await upstream.text();
      const rewritten = rewritePlaylist(text, url);

      return new Response(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(message, { status: 500 });
  }
}
