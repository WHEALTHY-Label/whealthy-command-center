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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email, cohort_id } = await req.json();
    if (!email || !cohort_id) return json({ error: 'Missing required fields: email, cohort_id' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const cleanEmail = String(email).trim().toLowerCase();

    // Cohort must exist and be open
    const { data: cohort, error: cErr } = await supabase
      .from('challenge_cohorts')
      .select('id, name, status')
      .eq('id', cohort_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cohort) return json({ error: 'Cohort not found' }, 404);
    if (cohort.status !== 'open') return json({ error: 'This cohort is not open for joining' }, 409);

    // Member must have an active fast
    const { data: fasts, error: fErr } = await supabase
      .from('fasts')
      .select('id, created_at, cohort_id')
      .eq('member_email', cleanEmail)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (fErr) throw new Error(fErr.message);
    if (!fasts || fasts.length === 0) {
      return json({ error: 'No active fast to join a cohort with. Start a fast first.' }, 409);
    }

    const fast = fasts[0];
    if (fast.cohort_id === cohort_id) {
      return json({ joined: true, already: true, cohort_name: cohort.name });
    }

    const { error: uErr } = await supabase
      .from('fasts')
      .update({ cohort_id: cohort_id })
      .eq('id', fast.id);
    if (uErr) throw new Error(uErr.message);

    return json({ joined: true, cohort_name: cohort.name });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
