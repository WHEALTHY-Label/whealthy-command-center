import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// cohort-create — ADMIN ONLY (master or admin). Creates a challenge cohort.
// Verifies the caller's admin_role server-side; never trusts the client.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { email, name, start_date, end_date } = await req.json();
    if (!email) return j({ error: 'Missing email' }, 400);
    const caller = String(email).trim().toLowerCase();

    // ---- server-side admin gate ----
    const { data: who, error: wErr } = await sb.from('approved_members').select('admin_role').eq('email', caller).maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!who || (who.admin_role !== 'master' && who.admin_role !== 'admin')) {
      return j({ error: 'Admins only' }, 403);
    }

    // ---- validate ----
    const cohortName = String(name || '').trim();
    if (!cohortName) return j({ error: 'Cohort name is required' }, 400);
    if (!isDate(start_date) || !isDate(end_date)) return j({ error: 'start_date and end_date must be YYYY-MM-DD' }, 400);
    if (end_date < start_date) return j({ error: 'end_date cannot be before start_date' }, 400);

    // ---- create ----
    const { data: cohort, error: iErr } = await sb.from('challenge_cohorts')
      .insert({ name: cohortName, start_date, end_date, status: 'open', created_by: caller })
      .select('id, name, start_date, end_date, status, created_by, created_at')
      .single();
    if (iErr) throw new Error(iErr.message);

    return j({ created: true, cohort });
  } catch (e) { return j({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
