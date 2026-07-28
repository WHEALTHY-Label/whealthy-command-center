import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// skool-feed-sync v5 — real Skool feed via the authenticated Next.js page data. NEVER fabricates.
// v5: MIRRORS DELETIONS — after a successful fetch, cached posts that no longer appear on the
// Skool page are deleted, so a post removed in Skool disappears from the wall within one sync
// (≤15 min). Reconciliation runs ONLY on success with posts present; every failure path still
// leaves the last good cache untouched.
// Cookie is normalized: a bare auth_token JWT is wrapped as `auth_token=<jwt>`.

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const done = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function normCookie(raw: string): string { const t = raw.trim(); if (t.includes('auth_token=')) return t; if (t.startsWith('eyJ')) return 'auth_token=' + t; return t; }
function stripMd(s: unknown): string { return String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_>`~]/g, '').replace(/\s+/g, ' ').trim(); }
function authorName(u: any): string { if (!u) return 'Steward'; const f = (u.firstName || '').trim(); const l = (u.lastName || '').trim(); if (f && l) return f + ' ' + l[0].toUpperCase(); if (f) return f; return u.name || 'Steward'; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const rawCookie = Deno.env.get('SKOOL_BOT_COOKIE');
    const slug = Deno.env.get('SKOOL_GROUP_SLUG') || 'bakndcreator';
    if (!rawCookie) return done({ success: false, reason: 'not-configured', count: 0 });
    const cookie = normCookie(rawCookie);
    const base = 'https://www.skool.com';

    let res: Response;
    try { res = await fetch(base + '/' + slug, { headers: { 'Cookie': cookie, 'User-Agent': UA } }); }
    catch (e) { return done({ success: false, reason: 'fetch-error', detail: e instanceof Error ? e.message : String(e), count: 0 }); }
    if (!res.ok) return done({ success: false, reason: 'page-status-' + res.status, count: 0 });

    const html = await res.text();
    const marker = '<script id="__NEXT_DATA__" type="application/json">';
    const i = html.indexOf(marker);
    if (i < 0) return done({ success: false, reason: 'no-next-data', count: 0 });
    const j = html.indexOf('</script>', i);
    let pp: any;
    try { pp = JSON.parse(html.slice(i + marker.length, j))?.props?.pageProps; }
    catch (e) { return done({ success: false, reason: 'parse-error', count: 0 }); }
    if (!pp || !pp.self) return done({ success: false, reason: 'not-authenticated', count: 0 });

    const trees = Array.isArray(pp.postTrees) ? pp.postTrees : [];
    const posts = trees.map((t: any) => t && t.post).filter(Boolean).map((p: any) => ({
      id: String(p.id || ''),
      slug: String(p.name || ''),
      title: String((p.metadata && p.metadata.title) || '').slice(0, 200),
      excerpt: stripMd(p.metadata && p.metadata.content).slice(0, 200),
      author_name: authorName(p.user),
      likes: Number((p.metadata && p.metadata.upvotes) || 0),
      comments: Number((p.metadata && p.metadata.comments) || 0),
      posted_at: p.createdAt || new Date().toISOString()
    })).filter((p: any) => p.id && p.slug);

    if (posts.length === 0) return done({ success: true, count: 0, note: 'no-posts' });

    for (const post of posts) {
      const { error } = await sb.from('skool_posts').upsert({ ...post, synced_at: new Date().toISOString() });
      if (error) console.error('[skool-feed-sync] upsert', post.id, error.message);
    }

    // v5: mirror deletions — the wall shows exactly what the Skool page shows.
    const liveIds = posts.map((p: any) => p.id);
    let removed = 0;
    const { data: cached } = await sb.from('skool_posts').select('id');
    const stale = (cached || []).map((r: any) => r.id).filter((id: string) => !liveIds.includes(id));
    if (stale.length > 0) {
      const { error: delErr } = await sb.from('skool_posts').delete().in('id', stale);
      if (!delErr) removed = stale.length; else console.error('[skool-feed-sync] delete', delErr.message);
    }

    return done({ success: true, count: posts.length, removed });
  } catch (e) { return done({ success: false, reason: e instanceof Error ? e.message : String(e), count: 0 }); }
});
