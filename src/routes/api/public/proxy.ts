import { createFileRoute } from "@tanstack/react-router";

/**
 * StreamFlow — Universal anti-block proxy (Cloudflare Worker compatible).
 * - UA / header rotation (browsers, players, TV boxes)
 * - Streaming pass-through for HLS / MP4
 * - HLS manifest rewrite: nested URLs re-proxied automatically
 * - Fallback public CORS proxies if the origin blocks us
 * - In-memory LRU cache for playlist / manifest bodies
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36",
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.215 Safari/537.36 WebAppManager",
  "VLC/3.0.20 LibVLC/3.0.20",
  "Lavf/60.16.100",
  "IPTVSmartersPro/2.0",
  "TiviMate/4.7.0 (Linux;Android 12)",
  "Kodi/21.0 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/21.0",
];

const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9",
  "fr-FR,fr;q=0.9,en;q=0.8",
  "de-DE,de;q=0.9,en;q=0.8",
  "es-ES,es;q=0.9,en;q=0.8",
];

const FALLBACK_PROXIES: Array<(u: string) => string> = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
  (u) => `https://cors.eu.org/${u}`,
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// tiny LRU (bounded by count) for text bodies
class LRU {
  private map = new Map<string, { body: string; contentType: string; ts: number }>();
  constructor(private max: number, private ttlMs: number) {}
  get(k: string) {
    const v = this.map.get(k);
    if (!v) return null;
    if (Date.now() - v.ts > this.ttlMs) { this.map.delete(k); return null; }
    this.map.delete(k); this.map.set(k, v);
    return v;
  }
  set(k: string, body: string, contentType: string) {
    if (this.map.has(k)) this.map.delete(k);
    else if (this.map.size >= this.max) {
      const first = this.map.keys().next().value as string | undefined;
      if (first) this.map.delete(first);
    }
    this.map.set(k, { body, contentType, ts: Date.now() });
  }
}

const manifestCache = new LRU(120, 15_000);

function buildHeaders(target: string, attempt: number, isMedia: boolean): HeadersInit {
  let origin = "https://www.google.com";
  try { origin = new URL(target).origin; } catch { /* ignore */ }
  const ua = attempt < USER_AGENTS.length ? USER_AGENTS[attempt] : pick(USER_AGENTS);
  const h: Record<string, string> = {
    "User-Agent": ua,
    "Accept": isMedia
      ? "*/*"
      : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": pick(ACCEPT_LANGUAGES),
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": origin + "/",
    "Origin": origin,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": isMedia ? "video" : "empty",
    "Sec-Fetch-Site": "cross-site",
    "Connection": "keep-alive",
  };
  return h;
}

function isManifestUrl(u: string, contentType: string) {
  const l = u.toLowerCase();
  return (
    contentType.includes("mpegurl") ||
    contentType.includes("application/x-mpegurl") ||
    contentType.includes("vnd.apple.mpegurl") ||
    l.endsWith(".m3u") || l.endsWith(".m3u8") ||
    l.includes(".m3u8?") || l.includes(".m3u?")
  );
}

/** Rewrite manifest URIs so nested segments/playlists go through our proxy. */
function rewriteManifest(text: string, base: string, proxyBase: string): string {
  const baseUrl = (() => { try { return new URL(base); } catch { return null; } })();
  const abs = (u: string): string => {
    if (!u) return u;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (!baseUrl) return u;
    try { return new URL(u, baseUrl).toString(); } catch { return u; }
  };
  const wrap = (u: string) => `${proxyBase}?url=${encodeURIComponent(u)}`;
  return text
    .split("\n")
    .map((raw) => {
      const line = raw.trim();
      if (!line) return raw;
      if (line.startsWith("#")) {
        // Rewrite URI="..." attributes (KEYS, MAP, MEDIA…)
        return raw.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${wrap(abs(u))}"`);
      }
      return wrap(abs(line));
    })
    .join("\n");
}

async function fetchUpstream(target: string, method: string, range: string | null): Promise<Response> {
  const isMedia = /\.(ts|mp4|m4s|aac|mp3|vtt|webm|mkv|jpg|jpeg|png|webp|ico)(\?|$)/i.test(target);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const headers = buildHeaders(target, attempt, isMedia) as Record<string, string>;
      if (range) headers["Range"] = range;
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), isMedia ? 30_000 : 20_000);
      const res = await fetch(target, {
        method,
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(to);
      if (res.ok || res.status === 206) return res;
      // Consume body to free connection
      try { await res.arrayBuffer(); } catch { /* ignore */ }
      if (res.status < 500 && res.status !== 403 && res.status !== 429) return res;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, Math.min(500 * (attempt + 1), 2000)));
  }
  // Fallback: public CORS proxies (text-only usefulness)
  for (const fn of FALLBACK_PROXIES) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(fn(target), { method, signal: controller.signal });
      clearTimeout(to);
      if (res.ok) return res;
    } catch { /* continue */ }
  }
  throw new Error(lastErr ? String(lastErr) : "All upstream attempts failed");
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });
  let parsed: URL;
  try { parsed = new URL(target); } catch { return new Response("Bad url", { status: 400 }); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response("Bad protocol", { status: 400 });
  }

  const method = request.method === "HEAD" ? "HEAD" : "GET";
  const range = request.headers.get("range");
  const proxyBase = `${url.origin}/api/public/proxy`;

  // manifest cache lookup (only for GET without range)
  if (method === "GET" && !range) {
    const cached = manifestCache.get(target);
    if (cached) {
      return new Response(cached.body, {
        status: 200,
        headers: {
          "content-type": cached.contentType,
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=5",
          "x-cache": "HIT",
        },
      });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, method, range);
  } catch (e) {
    // For images, fall back to a redirect so the browser loads the origin
    // directly instead of surfacing a 500 blank screen.
    if (/\.(png|jpe?g|webp|gif|svg|ico)(\?|$)/i.test(target)) {
      return Response.redirect(target, 302);
    }
    return new Response(`Upstream error: ${(e as Error).message}`, {
      status: 502,
      headers: { "access-control-allow-origin": "*" },
    });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  // Image fallback: if upstream failed, redirect the browser to the origin URL.
  if (
    method === "GET" &&
    !upstream.ok &&
    upstream.status !== 206 &&
    /\.(png|jpe?g|webp|gif|svg|ico)(\?|$)/i.test(target)
  ) {
    try { await upstream.arrayBuffer(); } catch { /* ignore */ }
    return Response.redirect(target, 302);
  }

  const outHeaders = new Headers();
  outHeaders.set("access-control-allow-origin", "*");
  outHeaders.set("access-control-expose-headers", "Content-Length,Content-Range,Accept-Ranges");
  outHeaders.set("content-type", contentType);
  for (const h of ["content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) outHeaders.set(h, v);
  }

  // Rewrite HLS manifests so nested segments also go via the proxy.
  if (method === "GET" && isManifestUrl(target, contentType)) {
    const text = await upstream.text();
    const rewritten = rewriteManifest(text, target, proxyBase);
    manifestCache.set(target, rewritten, contentType);
    outHeaders.set("cache-control", "public, max-age=5");
    outHeaders.set("x-cache", "MISS");
    return new Response(rewritten, { status: upstream.status, headers: outHeaders });
  }

  // Otherwise stream through.
  outHeaders.set("cache-control", upstream.headers.get("cache-control") || "public, max-age=30");
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      HEAD: ({ request }) => handle(request),
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,HEAD,OPTIONS",
            "access-control-allow-headers": "*",
          },
        }),
    },
  },
});
