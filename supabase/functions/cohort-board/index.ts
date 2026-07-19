import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Chicago-local calendar date, matching discipline-day and the client dayKey.
function toChicagoDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function daysBetween(startStr: string, endStr: string): number {
  const a = new Date(startStr + 'T00:00:00Z').getTime();
  const b = new Date(endStr + 'T00:00:00Z').getTime();
  return Math.floor((b - a) / 86400000);
}

// First name + last initial only. Never the full name, never the email.
function displayName(name: string | null, lastName: string | null): string {
  const n = (name || '').trim();
  const first = n.split(/\s+/)[0] || 'Steward';
  let initial = '';
  if (lastName && lastName.trim()) initial = lastName.trim()[0];
  else {
    const parts = n.split(/\s+/);
    if (parts.length > 1) initial = parts[parts.length - 1][0];
  }
  return initial ? `${first} ${initial.toUpperCase()}` : first;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { cohort_id } = await req.json();
    if (!cohort_id) return json({ error: 'Missing required field: cohort_id' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: cohort, error: cErr } = await supabase
      .from('challenge_cohorts')
      .select('id, name, start_date, end_date, status')
      .eq('id', cohort_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cohort) return json({ error: 'Cohort not found' }, 404);

    const today = toChicagoDate(new Date());
    const of = daysBetween(cohort.start_date, cohort.end_date) + 1;
    let day = daysBetween(cohort.start_date, today) + 1;
    if (day < 0) day = 0;
    if (day > of) day = of;

    // All fasts stamped with this cohort
    const { data: fasts, error: fErr } = await supabase
      .from('fasts')
      .select('id, member_email, created_at')
      .eq('cohort_id', cohort_id);
    if (fErr) throw new Error(fErr.message);

    const rows = fasts || [];
    if (rows.length === 0) {
      return json({ cohort: cohort.name, day, of, status: cohort.status, members: [] });
    }

    // Count kept fast-days per member fast (fast reports = record_entries with that fast_id, not burned)
    const emails = Array.from(new Set(rows.map(r => r.member_email)));
    const fastIds = rows.map(r => r.id);

    const { data: reports, error: rErr } = await supabase
      .from('record_entries')
      .select('fast_id, entry_date, burned')
      .in('fast_id', fastIds)
      .eq('burned', false);
    if (rErr) throw new Error(rErr.message);

    const keptByFast = new Map<string, Set<string>>();
    for (const rep of (reports || [])) {
      if (!rep.fast_id || !rep.entry_date) continue;
      if (!keptByFast.has(rep.fast_id)) keptByFast.set(rep.fast_id, new Set());
      keptByFast.get(rep.fast_id)!.add(rep.entry_date);
    }

    const { data: members, error: mErr } = await supabase
      .from('approved_members')
      .select('email, name, last_name')
      .in('email', emails);
    if (mErr) throw new Error(mErr.message);
    const memberByEmail = new Map<string, { name: string | null; last_name: string | null }>();
    for (const m of (members || [])) memberByEmail.set(m.email, { name: m.name, last_name: m.last_name });

    const board = rows.map(r => {
      const info = memberByEmail.get(r.member_email) || { name: null, last_name: null };
      return {
        name: displayName(info.name, info.last_name),
        days_kept: keptByFast.get(r.id)?.size || 0,
        joined_at: r.created_at,
      };
    });

    board.sort((a, b) => {
      if (b.days_kept !== a.days_kept) return b.days_kept - a.days_kept;
      return String(a.joined_at).localeCompare(String(b.joined_at));
    });

    return json({
      cohort: cohort.name,
      day,
      of,
      status: cohort.status,
      members: board.map(b => ({ name: b.name, days_kept: b.days_kept })),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
