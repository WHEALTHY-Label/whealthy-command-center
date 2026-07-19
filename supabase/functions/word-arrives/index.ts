import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function toChicagoDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = fmt.formatToParts(d);
  return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}-${p.find(x=>x.type==='day')!.value}`;
}
// Deterministic 32-bit hash (FNV-1a) over a string. Same input -> same output, always.
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function daysSinceEpoch(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 86400000);
}

async function fnFetch(path: string, body: unknown): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY },
    body: JSON.stringify(body),
  });
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email } = await req.json();
    if (!email) return json({ error: 'Missing required field: email' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const cleanEmail = String(email).trim().toLowerCase();
    const today = toChicagoDate(new Date());

    const { data: member, error: mErr } = await supabase
      .from('approved_members').select('id, archetype').eq('email', cleanEmail).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) return json({ arrived: false, reason: 'not-a-member' });

    // Idempotent: if a word already arrived today, return the same one.
    const { data: existing } = await supabase
      .from('word_deliveries').select('ref').eq('member_id', member.id).eq('delivered_on', today).maybeSingle();
    if (existing) {
      const v = await fnFetch('bible-verses', { ref: existing.ref });
      return json({ arrived: true, ref: existing.ref, text: v.text || '', reference: v.reference || existing.ref, reason: 'already-today' });
    }

    // Must be a kept day (Decision 1: any one discipline). Ledger is the source of truth.
    const ledger = await fnFetch('discipline-day', { email: cleanEmail, from: today, to: today });
    const t = ledger && ledger.today ? ledger.today : null;
    const keptToday = !!t && (t.word === true || t.prayer === true || t.record === true || t.fast === true);
    if (!keptToday) return json({ arrived: false, reason: 'day-not-kept' });

    // Deterministic frequency gate: about one kept day in three.
    const seed = hashStr(`${member.id}-${today}`);
    if (seed % 3 !== 0) return json({ arrived: false, reason: 'not-today' });

    // Hard cap: at most 2 deliveries in the rolling 7 days.
    const weekAgo = toChicagoDate(new Date(Date.now() - 6 * 86400000));
    const { count: recentCount, error: cErr } = await supabase
      .from('word_deliveries').select('id', { count: 'exact', head: true })
      .eq('member_id', member.id).gte('delivered_on', weekAgo).lte('delivered_on', today);
    if (cErr) throw new Error(cErr.message);
    if ((recentCount || 0) >= 2) return json({ arrived: false, reason: 'weekly-cap' });

    // Candidate refs for this archetype (fall back to general), minus anything delivered in the last 30 days.
    const archetype = member.archetype || 'general';
    let { data: pool } = await supabase.from('word_bank').select('ref').eq('archetype', archetype);
    if (!pool || pool.length === 0) {
      const g = await supabase.from('word_bank').select('ref').eq('archetype', 'general');
      pool = g.data || [];
    }
    const thirtyAgo = toChicagoDate(new Date(Date.now() - 30 * 86400000));
    const { data: recent } = await supabase
      .from('word_deliveries').select('ref').eq('member_id', member.id).gte('delivered_on', thirtyAgo);
    const seen = new Set((recent || []).map(r => r.ref));
    let candidates = pool.map(r => r.ref).filter(r => !seen.has(r));
    if (candidates.length === 0) candidates = pool.map(r => r.ref); // all seen recently: allow repeat
    if (candidates.length === 0) return json({ arrived: false, reason: 'empty-bank' });

    candidates.sort();
    const ref = candidates[seed % candidates.length];

    const v = await fnFetch('bible-verses', { ref });
    if (!v || !v.text) return json({ arrived: false, reason: 'verse-unresolved', ref });

    const { error: insErr } = await supabase
      .from('word_deliveries').insert({ member_id: member.id, ref, delivered_on: today });
    if (insErr && !String(insErr.message).includes('duplicate')) throw new Error(insErr.message);

    return json({ arrived: true, ref, text: v.text, reference: v.reference || ref, reason: archetype });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
