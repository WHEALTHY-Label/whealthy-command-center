import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// skool-feed-sync v2 — NEVER fabricates. Real Skool posts or nothing.
// - No cookie: write nothing, report not-configured (the wall stays hidden).
// - Fetch fails / non-200 / empty: do NOT overwrite the cache (keep the last good sync).
// - Only rows with a real id AND slug are stored, so no post ever links to a dead URL.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const done = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const cookie = Deno.env.get('SKOOL_BOT_COOKIE');
    const groupSlug = Deno.env.get('SKOOL_GROUP_SLUG') || 'bakndcreator';

    // No cookie configured: never fabricate. Leave the cache untouched.
    if (!cookie) return done({ success: false, reason: 'not-configured', count: 0 });

    let res: Response;
    try {
      res = await fetch(`https://www.skool.com/api/v1/posts?group_slug=${groupSlug}&limit=20`, {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
    } catch (err) {
      // Network error: keep the last good sync, never fabricate.
      return done({ success: false, reason: 'fetch-error', detail: err instanceof Error ? err.message : String(err), count: 0 });
    }

    if (!res.ok) return done({ success: false, reason: `skool-status-${res.status}`, count: 0 });

    const data = await res.json().catch(() => null);
    const raw = data?.posts || data?.data?.posts || [];
    if (!Array.isArray(raw) || raw.length === 0) {
      // Real but empty: leave the cache as-is. Never fabricate.
      return done({ success: true, count: 0, note: 'no-posts-returned' });
    }

    const posts = raw.map((p: any) => ({
      id: String(p.id || p.post_id || ''),
      slug: String(p.slug || p.permalink_slug || ''),
      title: String(p.title || ''),
      excerpt: String(p.excerpt || p.content || '').slice(0, 200),
      author_name: String(p.author?.name || p.author_name || 'Steward'),
      likes: Number(p.likes_count || p.likes || 0),
      comments: Number(p.comments_count || p.comments || 0),
      posted_at: p.created_at || p.posted_at || new Date().toISOString()
    })).filter((p: any) => p.id && p.slug); // real id + slug only, so links always resolve

    if (posts.length === 0) return done({ success: true, count: 0, note: 'no-valid-posts' });

    for (const post of posts) {
      const { error } = await sb.from('skool_posts').upsert({ ...post, synced_at: new Date().toISOString() });
      if (error) console.error('[skool-feed-sync] upsert', post.id, error.message);
    }

    const { data: all } = await sb.from('skool_posts').select('id').order('posted_at', { ascending: false });
    if (all && all.length > 50) {
      await sb.from('skool_posts').delete().in('id', all.slice(50).map((p: any) => p.id));
    }

    return done({ success: true, count: posts.length });
  } catch (e) {
    // Never fabricate on error; leave the cache intact.
    return done({ success: false, reason: e instanceof Error ? e.message : String(e), count: 0 });
  }
});
