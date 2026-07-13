/**
 * Client helpers for the StreamFlow universal proxy.
 * All stream / playlist / image fetches go through /api/public/proxy so
 * the origin server sees rotated headers instead of the browser's real
 * fingerprint. This is our anti-blocking front line.
 */

const PROXY = "/api/public/proxy";

export function proxyUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith(PROXY) || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return url;
  return `${PROXY}?url=${encodeURIComponent(url)}`;
}

export function proxyImage(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/")) return url;
  return `${PROXY}?url=${encodeURIComponent(url)}`;
}

const playlistCache = new Map<string, { body: string; ts: number }>();
const TTL = 5 * 60_000;

/** Fetch a playlist / text resource via the proxy, with local cache + retries. */
export async function fetchViaProxy(url: string, opts: { retries?: number; timeoutMs?: number; cache?: boolean } = {}): Promise<string> {
  const { retries = 3, timeoutMs = 30_000, cache = true } = opts;
  if (cache) {
    const hit = playlistCache.get(url);
    if (hit && Date.now() - hit.ts < TTL) return hit.body;
  }
  let lastErr: unknown = null;
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(proxyUrl(url), { signal: ctrl.signal });
      clearTimeout(to);
      if (res.ok) {
        const text = await res.text();
        if (text.length) {
          if (cache) playlistCache.set(url, { body: text, ts: Date.now() });
          return text;
        }
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** i, 4000)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
