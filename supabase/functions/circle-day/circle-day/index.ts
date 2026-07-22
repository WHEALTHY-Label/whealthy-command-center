import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function chicago(d: Date): string {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(d);
  return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}-${p.find(x=>x.type==='day')!.value}`;
}
function dayIndex(startStr: string, dStr: string): number {
  const a = new Date(startStr + 'T00:00:00Z').getTime();
  const b = new Date(dStr + 'T00:00:00Z').getTime();
  return Math.floor((b - a) / 86400000) + 1;
}
function firstInitial(name: string | null, last: string | null): string {
  const n = (name || '').trim(); const first = n.split(/\s+/)[0] || 'Steward';
  let ini = ''; if (last && last.trim()) ini = last.trim()[0]; else { const parts = n.split(/\s+/); if (parts.length > 1) ini = parts[parts.length-1][0]; }
  return ini ? `${first} ${ini.toUpperCase()}` : first;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  try {
    const { circle_id, email } = await req.json();
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    let targetCircleId = circle_id;
    if (!targetCircleId) {
      if (!email) return j({ error: 'Missing circle_id or email' }, 400);
      const cleanEmail = String(email).trim().toLowerCase();
      const { data: member, error: mErr } = await sb.from('approved_members').select('id').eq('email', cleanEmail).maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!member) return j({ error: 'Not a member' }, 403);

      const { data: cm, error: cmErr } = await sb.from('circle_members').select('circle_id').eq('member_id', member.id).maybeSingle();
      if (cmErr) throw new Error(cmErr.message);
      if (!cm) return j({ circle: null });
      targetCircleId = cm.circle_id;
    }

    const today = chicago(new Date());

    const { data: circle } = await sb.from('circles').select('id, name, invite_code').eq('id', targetCircleId).maybeSingle();
    if (!circle) return j({ error: 'Circle not found' }, 404);

    const { data: cmRows, error: cmErr } = await sb.from('circle_members').select('member_id, role, joined_at').eq('circle_id', targetCircleId).order('joined_at');
    if (cmErr) throw new Error(cmErr.message);
    const rows = cmRows || [];
    if (rows.length === 0) return j({ circle: circle.name, circle_id: circle.id, invite_code: circle.invite_code, members: [] });

    const ids = rows.map(r => r.member_id);
    const { data: ams } = await sb.from('approved_members').select('id, email, name, last_name').in('id', ids);
    const byId = new Map<number, { email: string; name: string | null; last_name: string | null }>();
    for (const a of (ams || [])) byId.set(a.id, { email: a.email, name: a.name, last_name: a.last_name });
    const emails = (ams || []).map(a => a.email);

    // Batch today-signals
    const [bibleRes, wallRes, prayRes, fastRes, recRes, cpRes] = await Promise.all([
      sb.from('bible_progress').select('email, start_date, completed_days').in('email', emails),
      sb.from('wall_prays').select('member_id, created_at').in('member_id', ids),
      sb.from('prayers').select('member_id, asked_on, created_at').in('member_id', ids),
      sb.from('fasts').select('id, member_email, status').in('member_email', emails).eq('status', 'active'),
      sb.from('record_entries').select('member_email, entry_date, fast_id, burned').in('member_email', emails).eq('entry_date', today),
      sb.from('circle_prays').select('from_member, for_member').eq('circle_id', targetCircleId).eq('day', today),
    ]);

    const bibleByEmail = new Map<string, { start_date: string; completed_days: number[] }>();
    for (const b of (bibleRes.data || [])) bibleByEmail.set(b.email, { start_date: b.start_date, completed_days: b.completed_days || [] });

    const prayerSet = new Set<number>();
    for (const w of (wallRes.data || [])) if (w.created_at && chicago(new Date(w.created_at)) === today) prayerSet.add(w.member_id);
    for (const p of (prayRes.data || [])) { if (p.asked_on === today) prayerSet.add(p.member_id); else if (p.created_at && chicago(new Date(p.created_at)) === today) prayerSet.add(p.member_id); }

    const activeFastByEmail = new Map<string, string>();
    for (const f of (fastRes.data || [])) activeFastByEmail.set(f.member_email, f.id);
    const recToday = new Set<string>();       // member_email with a non-burned record today
    const fastReportToday = new Set<string>(); // `${email}|${fast_id}` reported today
    for (const r of (recRes.data || [])) {
      if (r.burned) continue;
      recToday.add(r.member_email);
      if (r.fast_id) fastReportToday.add(`${r.member_email}|${r.fast_id}`);
    }

    // viewer's own prays given today (per recipient) for button state
    let viewerId: number | null = null;
    if (email) { const v = (ams || []).find(a => a.email === String(email).trim().toLowerCase()); if (v) viewerId = v.id; }
    const viewerPraysFor = new Map<number, number>();
    for (const cp of (cpRes.data || [])) if (viewerId && cp.from_member === viewerId) viewerPraysFor.set(cp.for_member, (viewerPraysFor.get(cp.for_member) || 0) + 1);

    const members = rows.map(r => {
      const info = byId.get(r.member_id) || { email: '', name: null, last_name: null };
      const bp = bibleByEmail.get(info.email);
      let word = false;
      if (bp && bp.start_date && bp.completed_days.length) word = bp.completed_days.includes(dayIndex(bp.start_date, today));
      const prayer = prayerSet.has(r.member_id);
      const hasFast = activeFastByEmail.has(info.email);
      const fast = hasFast ? fastReportToday.has(`${info.email}|${activeFastByEmail.get(info.email)}`) : null;
      const record = recToday.has(info.email);
      return {
        member_id: r.member_id,
        name: firstInitial(info.name, info.last_name),
        role: r.role,
        word, prayer, fast, record,
        i_prayed_count: viewerPraysFor.get(r.member_id) || 0,
      };
    });

    return j({ circle: circle.name, circle_id: circle.id, invite_code: circle.invite_code, today, members });
  } catch (e) { return j({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
