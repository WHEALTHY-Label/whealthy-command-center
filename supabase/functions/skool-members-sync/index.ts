import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// skool-members-sync — pulls the community roster (handles + names + avatars) from
// the authenticated Skool members page (/-/members, paginated ?p=N) and upserts it
// into skool_members. Also backfills approved_members.skool_handle/skool_user_id by
// email match (never clobbering an existing handle). Same cookie mechanism as the feed
// sync; NEVER fabricates: on any block/parse failure it writes nothing and keeps the
// last good roster. Ungated like skool-feed-sync (cron-triggered) with a short cooldown
// so it cannot be hammered into Skool.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const done = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
function normCookie(raw: string): string { const t = raw.trim(); if (t.includes('auth_token=')) return t; if (t.startsWith('eyJ')) return 'auth_token=' + t; return t; }
function clean(v: unknown, max = 300): string | null { if (v === null || v === undefined) return null; const s = String(v).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, max); return s.length ? s : null; }

let lastRun = 0;
const COOLDOWN = 20_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const now = Date.now();
  if (now - lastRun < COOLDOWN) return done({ success: false, reason: 'cooldown', count: 0 });
  lastRun = now;

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const rawCookie = Deno.env.get('SKOOL_BOT_COOKIE');
    const slug = Deno.env.get('SKOOL_GROUP_SLUG') || 'bakndcreator';
    if (!rawCookie) return done({ success: false, reason: 'not-configured', count: 0 });
    const cookie = normCookie(rawCookie);
    const base = 'https://www.skool.com/' + slug + '/-/members';

    async function fetchPage(page: number): Promise<{ ok: boolean; pp?: any; reason?: string }> {
      const url = base + (page > 1 ? ('?p=' + page) : '');
      let res: Response;
      try { res = await fetch(url, { headers: { Cookie: cookie, 'User-Agent': UA } }); }
      catch (e) { return { ok: false, reason: 'fetch-error:' + (e instanceof Error ? e.message : String(e)) }; }
      if (!res.ok) return { ok: false, reason: 'status-' + res.status };
      const html = await res.text();
      if (/aws-waf|challenge-container|__CF\$cv\$params/i.test(html)) return { ok: false, reason: 'blocked-upstream' };
      const marker = '<script id="__NEXT_DATA__" type="application/json">';
      const i = html.indexOf(marker); if (i < 0) return { ok: false, reason: 'no-next-data' };
      const j = html.indexOf('</script>', i);
      let pp: any; try { pp = JSON.parse(html.slice(i + marker.length, j))?.props?.pageProps; } catch (_e) { return { ok: false, reason: 'parse-error' }; }
      if (!pp || !pp.self) return { ok: false, reason: 'not-authenticated' };
      return { ok: true, pp };
    }

    const first = await fetchPage(1);
    if (!first.ok) return done({ success: false, reason: first.reason, count: 0 });
    const totalPages = Math.max(1, Number(first.pp.totalPages) || 1);
    let users: any[] = Array.isArray(first.pp.users) ? first.pp.users.slice() : [];
    for (let p = 2; p <= totalPages && p <= 15; p++) {
      const pg = await fetchPage(p);
      if (pg.ok && Array.isArray(pg.pp.users)) users = users.concat(pg.pp.users);
    }
    if (users.length === 0) return done({ success: true, count: 0, note: 'no-users' });

    const seen = new Set<string>();
    const rows = users.map((u: any) => {
      const m = u.metadata || {};
      const first_name = clean(u.firstName, 100);
      const last_name = clean(u.lastName, 100);
      const full = [first_name, last_name].filter(Boolean).join(' ') || null;
      return {
        skool_user_id: clean(u.id, 64) || '',
        handle: (clean(u.name, 100) || '').toLowerCase(),
        first_name, last_name, full_name: full,
        email: u.email ? String(u.email).toLowerCase().trim() : null,
        avatar_url: clean(m.pictureProfile, 600),
        role: clean(u.member && u.member.role, 40),
        bio: clean(m.bio, 500),
        synced_at: new Date().toISOString(),
      };
    }).filter((r: any) => r.skool_user_id && r.handle && !seen.has(r.skool_user_id) && seen.add(r.skool_user_id));

    let upserted = 0;
    for (const r of rows) {
      const { error } = await sb.from('skool_members').upsert(r, { onConflict: 'skool_user_id' });
      if (!error) upserted++; else console.error('[members-sync] upsert', r.handle, error.message);
    }

    // backfill approved_members handle/id by email match, without clobbering existing handles
    let linked = 0;
    for (const r of rows) {
      if (!r.email) continue;
      const { data, error } = await sb.from('approved_members')
        .update({ skool_handle: r.handle, skool_user_id: r.skool_user_id })
        .ilike('email', r.email)
        .is('skool_handle', null)
        .select('id');
      if (!error && data) linked += data.length;
    }

    return done({ success: true, count: rows.length, upserted, linked, pages: totalPages });
  } catch (e) { return done({ success: false, reason: e instanceof Error ? e.message : String(e), count: 0 }); }
});
