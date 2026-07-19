import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  const bytes = new Uint8Array(6); crypto.getRandomValues(bytes);
  let out = ''; for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  try {
    const { email, name } = await req.json();
    if (!email || !name || !String(name).trim()) return j({ error: 'Missing email or circle name' }, 400);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const cleanEmail = String(email).trim().toLowerCase();

    const { data: member, error: mErr } = await sb.from('approved_members').select('id').eq('email', cleanEmail).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) return j({ error: 'Not a member' }, 403);

    // Generate a unique invite code (retry on the rare collision)
    let code = inviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: clash } = await sb.from('circles').select('id').eq('invite_code', code).maybeSingle();
      if (!clash) break;
      code = inviteCode();
    }

    const { data: circle, error: cErr } = await sb.from('circles')
      .insert({ name: String(name).trim().slice(0, 60), invite_code: code, created_by: member.id, max_size: 7 })
      .select('id, name, invite_code').single();
    if (cErr) throw new Error(cErr.message);

    const { error: jmErr } = await sb.from('circle_members').insert({ circle_id: circle.id, member_id: member.id, role: 'shepherd' });
    if (jmErr) throw new Error(jmErr.message);

    return j({ created: true, circle_id: circle.id, name: circle.name, invite_code: circle.invite_code });
  } catch (e) { return j({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
