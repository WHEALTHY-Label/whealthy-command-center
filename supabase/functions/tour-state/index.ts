import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// tour-state v2 — per-member guided-tour + First Steps persistence. ATOMIC.
// POST { done?: true, steps?: { <flag>: true, ... } }
// Identity comes ONLY from the verified Supabase session JWT (Authorization: Bearer).
// Writes go through the tour_state_update RPC (single UPDATE: jsonb || merge +
// coalesce'd tour_done_at) so concurrent calls can never lose flags.
// Returns { ok, tour_done_at, first_steps }.

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const ALLOWED_STEPS = new Set(['bundle', 'word', 'wall', 'record', 'community', 'fast', 'code']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json({ error: 'not_authorized', reason: 'no_token' }, 401);
  const { data: uData, error: uErr } = await sb.auth.getUser(token);
  const email = uData?.user?.email?.toLowerCase() || '';
  if (uErr || !email) return json({ error: 'not_authorized', reason: 'invalid_token' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { /* empty body ok */ }

  // sanitize steps to the whitelist, true-only
  const steps: Record<string, boolean> = {};
  if (body.steps && typeof body.steps === 'object' && !Array.isArray(body.steps)) {
    for (const [k, v] of Object.entries(body.steps as Record<string, unknown>)) {
      if (ALLOWED_STEPS.has(k) && v === true) steps[k] = true;
    }
  }

  const { data, error } = await sb.rpc('tour_state_update', {
    p_email: email,
    p_done: body.done === true,
    p_steps: steps,
  });
  if (error) { console.error('rpc error:', error.message); return json({ error: 'server_error' }, 500); }
  if (!data || data.length === 0) return json({ error: 'not_a_member' }, 403);

  const row = data[0] as { tour_done_at: string | null; first_steps: Record<string, boolean> };
  return json({ ok: true, tour_done_at: row.tour_done_at ?? null, first_steps: row.first_steps ?? {} });
});
