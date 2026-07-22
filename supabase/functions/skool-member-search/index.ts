import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// skool-member-search — PRE-AUTH typeahead for the locate screen.
// Given q (>= 2 chars), returns up to 8 community members whose handle or name
// matches, so a real member can recognise and pick themselves before signing in.
//
// Returns PUBLIC profile fields ONLY: handle, display name, avatar. No email, no
// membership/billing data. (These same fields are public on skool.com/@handle.)
// It does reveal that a matched name is in the community, so it is rate-limited and
// requires a real query; it never lists the whole roster.

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });

// per-IP limit: search hits our DB only (no Skool), so it can be generous, but still
// bounded so the endpoint cannot be scraped into a full membership dump.
const hits = new Map<string, { n: number; t: number }>();
const WINDOW = 60_000;
const MAX = 90;
function limited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > WINDOW) { hits.set(ip, { n: 1, t: now }); return false; }
  e.n++; return e.n > MAX;
}

function normQ(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9\- ]/g, '').slice(0, 60);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { return json({ results: [] }); }
  const q = normQ(String(body.q ?? body.handle ?? ''));
  if (q.length < 2) return json({ results: [] });

  if (limited(ip)) return json({ error: 'rate_limited', results: [], retry_after: 60 }, 429);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.from('skool_members').select('handle, first_name, last_name, full_name, avatar_url');
  if (error) return json({ results: [], error: 'lookup_failed' }, 500);

  const rows = data || [];
  const scored: { s: number; label: string; r: any }[] = [];
  for (const r of rows) {
    const handle = String(r.handle || '').toLowerCase();
    const fn = String(r.first_name || '').toLowerCase();
    const ln = String(r.last_name || '').toLowerCase();
    const full = String(r.full_name || '').toLowerCase();
    let s = -1;
    if (handle.startsWith(q) || fn.startsWith(q) || full.startsWith(q)) s = 0;
    else if (ln.startsWith(q)) s = 1;
    else if (handle.includes(q) || full.includes(q)) s = 2;
    if (s >= 0) scored.push({ s, label: full || handle, r });
  }
  scored.sort((a, b) => a.s - b.s || a.label.localeCompare(b.label));

  const results = scored.slice(0, 8).map(({ r }) => ({
    handle: r.handle,
    name: r.full_name || ('@' + r.handle),
    avatar_url: r.avatar_url || null,
    found: true,
  }));
  return json({ results }, 200, { 'Cache-Control': 'no-store' });
});
