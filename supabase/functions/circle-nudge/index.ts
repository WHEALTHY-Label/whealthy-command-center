import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function chicago(d: Date): string {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(d);
  return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}-${p.find(x=>x.type==='day')!.value}`;
}
const MAX_PER_DAY = 3; // Decision 10: match the Wall, up to 3 per person per day

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  try {
    const { email, circle_id, for_member } = await req.json();
    if (!email || !circle_id || !for_member) return j({ error: 'Missing email, circle_id, or for_member' }, 400);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const cleanEmail = String(email).trim().toLowerCase();
    const today = chicago(new Date());

    const { data: member } = await sb.from('approved_members').select('id').eq('email', cleanEmail).maybeSingle();
    if (!member) return j({ error: 'Not a member' }, 403);
    const fromId = member.id;
    if (fromId === for_member) return j({ error: 'You cannot pray-nudge yourself' }, 400);

    const { data: mems } = await sb.from('circle_members').select('member_id').eq('circle_id', circle_id).in('member_id', [fromId, for_member]);
    const memSet = new Set((mems || []).map(m => m.member_id));
    if (!memSet.has(fromId) || !memSet.has(for_member)) return j({ error: 'Both members must be in the circle' }, 403);

    // Atomic cap via the nth column (1..3, unique). Try the next free ordinal;
    // a race that computes the same nth collides on the unique constraint, so 3 can never be exceeded.
    for (let attempt = 0; attempt < MAX_PER_DAY + 1; attempt++) {
      const { count } = await sb.from('circle_prays').select('id', { count: 'exact', head: true })
        .eq('circle_id', circle_id).eq('from_member', fromId).eq('for_member', for_member).eq('day', today);
      const used = count || 0;
      if (used >= MAX_PER_DAY) return j({ prayed: false, capped: true, count: MAX_PER_DAY, remaining: 0, message: 'You have lifted them up all you can today.' }, 200);
      const nth = used + 1;
      const { error: insErr } = await sb.from('circle_prays').insert({ circle_id, from_member: fromId, for_member, day: today, nth });
      if (!insErr) return j({ prayed: true, count: nth, remaining: MAX_PER_DAY - nth });
      // Unique collision from a concurrent tap: recount and retry with the next ordinal.
      if (String(insErr.message).includes('duplicate') || String(insErr.message).includes('unique')) continue;
      throw new Error(insErr.message);
    }
    return j({ prayed: false, capped: true, count: MAX_PER_DAY, remaining: 0, message: 'You have lifted them up all you can today.' }, 200);
  } catch (e) { return j({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
