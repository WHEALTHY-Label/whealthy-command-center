import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ verified: false, error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data, error } = await supabase
      .from('approved_members')
      .select('id, email, name, archetype, archetype_name, identity_anchor, member_status, admin_role, tour_done_at, first_steps')
      .eq('email', email.trim().toLowerCase())
      .limit(1);
    if (error) {
      console.error('DB error:', error);
      return new Response(JSON.stringify({ verified: false, error: 'Server error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (data && data.length > 0) {
      const member = data[0];
      // v25: activity ledger for DAU/WAU on the Control Panel.
      // Fire-and-forget: a failure here must NEVER break the gate.
      try {
        await supabase.from('app_events').insert({
          email: email.trim().toLowerCase(),
          event_type: 'app_open',
        });
      } catch (aeErr) {
        console.warn('app_events insert failed (non-blocking):', aeErr);
      }
      return new Response(JSON.stringify({
        verified: true,
        id: member.id,
        name: member.name,
        archetype: member.archetype,
        archetype_name: member.archetype_name,
        identity_anchor: member.identity_anchor,
        member_status: member.member_status || 'lead',
        admin_role: member.admin_role || null,
        tour_done_at: member.tour_done_at || null,
        first_steps: member.first_steps || {},
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ verified: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ verified: false, error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
