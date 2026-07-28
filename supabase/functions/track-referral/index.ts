import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const referral_code = (body.referral_code || '').trim();

    if (!referral_code || referral_code.length > 20) {
      return new Response(JSON.stringify({ error: 'Invalid referral code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the referral code exists and ambassador is active
    const { data: ambassador, error: ambError } = await supabase
      .from('ambassadors')
      .select('id, referral_code, first_name, status')
      .eq('referral_code', referral_code)
      .eq('status', 'active')
      .single();

    if (ambError || !ambassador) {
      return new Response(JSON.stringify({ valid: false, error: 'Referral code not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash the IP for dedup (never store raw IP)
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(ip + referral_code));
    const ip_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if this IP already clicked this code in the last 24 hours (dedup)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('ip_hash', ip_hash)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already tracked this click, just confirm the code is valid
      return new Response(JSON.stringify({
        valid: true,
        ambassador_name: ambassador.first_name,
        already_tracked: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record the referral click
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        ambassador_id: ambassador.id,
        referral_code: referral_code,
        status: 'clicked',
        ip_hash: ip_hash,
        user_agent: (req.headers.get('user-agent') || '').slice(0, 500),
        landing_page: (body.landing_page || '').slice(0, 500),
      });

    if (insertError) {
      console.error('Insert error:', insertError);
    }

    // Increment total_referrals on ambassador
    await supabase.rpc('increment_ambassador_referrals', { amb_code: referral_code }).catch(() => {});

    // Fallback: direct update if RPC doesn't exist yet
    await supabase
      .from('ambassadors')
      .update({ total_referrals: ambassador.total_referrals + 1 })
      .eq('id', ambassador.id)
      .catch(() => {});

    return new Response(JSON.stringify({
      valid: true,
      ambassador_name: ambassador.first_name,
      tracked: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});