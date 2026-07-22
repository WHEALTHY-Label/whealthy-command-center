import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { email } = await req.json();
    if (!email) return j({ error: 'Missing email parameter' }, 400);

    const cleanEmail = String(email).trim().toLowerCase();

    // Verify member_status = 'member' and active = true
    const { data: member, error: mErr } = await sb
      .from('approved_members')
      .select('member_status, active')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (mErr) throw new Error(mErr.message);

    // If not found or not active member, return empty feed
    if (!member || member.member_status !== 'member' || !member.active) {
      console.log(`[skool-feed] Access denied for ${cleanEmail} (status: ${member?.member_status || 'none'}, active: ${member?.active || 'false'})`);
      return j({ feed: [] });
    }

    // Retrieve cached community posts
    const { data: posts, error: pErr } = await sb
      .from('skool_posts')
      .select('id, slug, title, excerpt, author_name, likes, comments, posted_at')
      .order('posted_at', { ascending: false })
      .limit(50);

    if (pErr) throw new Error(pErr.message);

    return j({ feed: posts || [] });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});