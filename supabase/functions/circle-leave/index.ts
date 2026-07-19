import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  try {
    const { email, circle_id } = await req.json();
    if (!email || !circle_id) return j({ error: 'Missing email or circle_id' }, 400);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const cleanEmail = String(email).trim().toLowerCase();

    const { data: member, error: mErr } = await sb.from('approved_members').select('id').eq('email', cleanEmail).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) return j({ error: 'Not a member' }, 403);

    const { error: delErr } = await sb.from('circle_members').delete().eq('circle_id', circle_id).eq('member_id', member.id);
    if (delErr) throw new Error(delErr.message);

    return j({ left: true });
  } catch (e) { return j({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
