// ============================================================
// EDGE FUNCTION: skool-profile-lookup
//
// SCREEN 1 of the dashboard flow: LOCATE.
// Fetches a PUBLIC Skool profile server-side and returns the
// name / avatar / handle so the member sees their own face
// before they authenticate.
//
// WHY THIS IS SAFE TO BUILD:
// Public profile pages are server-rendered, unauthenticated,
// and Google-indexed. No cookie, no WAF, no session. This is
// NOT the members.json path (cookie + AWS WAF bound, which is
// why the cancel path uses the weekly CSV instead).
//
// WHAT IT DELIBERATELY DOES NOT RETURN:
// member_status. This endpoint is PRE-AUTH. Returning
// membership here would turn it into an enumeration oracle:
// anyone could map the paid community by typing handles.
// The gate fires AFTER password auth, inside the dashboard.
//
// THIS ENDPOINT IS NOT A SECURITY GATE AND CANNOT BE ONE.
// It reads public data. Knowing a handle proves nothing about
// the caller. Screen 1 is recognition; Screen 2 is security.
//
// Public data only. No secret required.
//
// -- 2026-07 typeahead revision --
// The locate screen now previews the profile live as the user
// types, so this endpoint sees bursts of a few calls per user
// instead of one. Two changes accommodate that WITHOUT giving
// a scraper more reach into Skool:
//   1. A shared response cache. Repeat lookups of the same
//      handle are served from memory and never touch Skool.
//      A scraper hammering one handle now costs Skool nothing.
//   2. The per-IP limit counts only requests that actually
//      reach Skool (cache misses). Cache hits are free. So the
//      ceiling on Skool traffic per IP is unchanged in spirit
//      while normal typing stops tripping it.
// ============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

// ---- response cache -----------------------------------------
// Keyed by handle. Serves repeat keystrokes and repeat visitors
// without a single extra request to Skool.
type Cached = { body: unknown; status: number; t: number };
const cache = new Map<string, Cached>();
const CACHE_TTL = 5 * 60_000; // 5 min
const CACHE_MAX = 500;

function cacheGet(h: string): Cached | null {
  const e = cache.get(h);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL) { cache.delete(h); return null; }
  return e;
}

function cacheSet(h: string, body: unknown, status: number) {
  if (cache.size >= CACHE_MAX) {
    // drop the oldest entry; this is a cache, not a database
    const oldest = [...cache.entries()].sort((a, b) => a[1].t - b[1].t)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(h, { body, status, t: Date.now() });
}

// ---- rate limit ---------------------------------------------
// Counts ONLY cache misses, i.e. requests that cost Skool
// something. Typing "iiggie" one letter at a time cannot burn
// the budget, but a scraper walking fresh handles still can.
const hits = new Map<string, { n: number; t: number }>();
const WINDOW = 60_000;
const MAX = 20; // upstream fetches per IP per minute

function limited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > WINDOW) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  e.n++;
  return e.n > MAX;
}

// Skool handles: lowercase alnum + hyphens. Strip a leading @,
// strip a full URL if pasted. Anything else is rejected before
// it ever reaches fetch(), so no SSRF surface.
function normalizeHandle(raw: string): string | null {
  let h = String(raw).trim().toLowerCase();
  h = h.replace(/^https?:\/\/(www\.)?skool\.com\//, "");
  h = h.replace(/^@/, "");
  h = h.split(/[/?#]/)[0];
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(h)) return null;
  return h;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\\u0026/g, "&")
    .trim();
}

function pick(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const v = decode(m[1]);
      if (v.length > 0 && v.length < 300) return v;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "invalid_json" }, 400);
  }

  const handle = normalizeHandle(String(body.handle ?? ""));
  if (!handle) {
    return json({
      found: false,
      error: "invalid_handle",
      hint: "Letters, numbers and hyphens only.",
    }, 400);
  }

  // Cache first: a hit costs Skool nothing, so it is never limited.
  const hit = cacheGet(handle);
  if (hit) return json(hit.body, hit.status, { "X-Cache": "HIT" });

  // Only now, when we are about to spend a Skool request, does the
  // per-IP budget apply.
  if (limited(ip)) return json({ error: "rate_limited", retry_after: 60 }, 429);

  const url = `https://www.skool.com/@${handle}`;

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (e) {
    console.error("fetch failed:", e);
    return json({ found: false, error: "upstream_unreachable" }, 502);
  }

  if (res.status === 404) {
    const b = { found: false, handle, reason: "no_such_profile" };
    cacheSet(handle, b, 200); // negatives cache too: stops repeat misses
    return json(b, 200, { "X-Cache": "MISS" });
  }
  if (!res.ok) {
    console.warn(`skool returned ${res.status} for @${handle}`);
    return json({ found: false, handle, error: "upstream_error", status: res.status }, 502);
  }

  const html = await res.text();

  // If Skool ever ships a login wall or WAF challenge on this
  // route, fail loudly rather than returning a half-parsed shell.
  if (/aws-waf|challenge-container|__CF\$cv\$params/i.test(html)) {
    return json({ found: false, handle, error: "blocked_upstream" }, 502);
  }

  const name = pick(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
    /"firstName"\s*:\s*"([^"]+)"/,
    /<title>([^<]+)<\/title>/i,
  ]);

  const avatar = pick(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /"pictureProfile"\s*:\s*"([^"]+)"/,
    /"picture"\s*:\s*"(https:\/\/assets\.skool\.com[^"]+)"/,
  ]);

  const bio = pick(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /"bio"\s*:\s*"([^"]+)"/,
  ]);

  // A profile page that renders no name is either not a profile
  // or Skool changed its markup. Either way, do not guess.
  if (!name) {
    const b = { found: false, handle, reason: "no_profile_data" };
    cacheSet(handle, b, 200);
    return json(b, 200, { "X-Cache": "MISS" });
  }

  // Strip Skool's site suffix from og:title if present.
  const cleanName = name
    .replace(/\s*[|\-–]\s*Skool\s*$/i, "")
    .replace(/^Skool\s*[|\-–]\s*/i, "")
    .trim();

  const out = {
    found: true,
    profile: {
      handle,
      name: cleanName,
      avatar_url: avatar && avatar.startsWith("http") ? avatar : null,
      bio: bio || null,
      profile_url: url,
    },
    // Deliberate: no membership data pre-auth.
  };
  cacheSet(handle, out, 200);
  return json(out, 200, { "X-Cache": "MISS" });
});
