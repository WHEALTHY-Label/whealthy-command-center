import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  try {
    const { email, invite_code } = await req.json();
    if (!email || !invite_code) return j({ error: 'Missing email or invite_code' }, 400);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const cleanEmail = String(email).trim().toLowerCase();
    const code = String(invite_code).trim().toUpperCase();

    const { data: member, error: mErr } = await sb.from('approved_members').select('id').eq('email', cleanEmail).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) return j({ error: 'Not a member' }, 403);

    const { data: circle, error: cErr } = await sb.from('circles').select('id, name, max_size').eq('invite_code', code).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!circle) return j({ error: 'That invite code was not found' }, 404);

    // Already a member?
    const { data: existing } = await sb.from('circle_members').select('member_id').eq('circle_id', circle.id).eq('member_id', member.id).maybeSingle();
    if (existing) return j({ joined: true, already: true, circle_name: circle.name, circle_id: circle.id });

    // Size cap
    const { count } = await sb.from('circle_members').select('member_id', { count: 'exact', head: true }).eq('circle_id', circle.id);
    if ((count || 0) >= circle.max_size) return j({ error: 'This circle is full' }, 409);

    const { error: insErr } = await sb.from('circle_members').insert({ circle_id: circle.id, member_id: member.id, role: 'member' });
    if (insErr && !String(insErr.message).includes('duplicate')) throw new Error(insErr.message);

    return j({ joined: true, circle_name: circle.name, circle_id: circle.id });
  } catch (e) { return j({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
