import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In-memory rate limiter (same pattern as add-member)
const rateLimitMap = new Map<string, { count: number; firstHit: number }>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || (now - entry.firstHit) > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(email, { count: 1, firstHit: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

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
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ verified: false, error: 'Valid email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isRateLimited(email)) {
      return new Response(JSON.stringify({ verified: false, error: 'Too many requests' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Member check: ANY active community member qualifies for the member code.
    // (Free tier gets 20% under the current model — no paid-status gate.)
    const { data: member, error: memberErr } = await supabase
      .from('approved_members')
      .select('email, member_status, active, active_through')
      .eq('email', email)
      .maybeSingle();

    if (memberErr) {
      console.error('DB error (member):', memberErr);
      return new Response(JSON.stringify({ verified: false, error: 'Server error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expired = member?.active_through && new Date(member.active_through) < new Date();
    if (!member || member.active === false || expired) {
      return new Response(JSON.stringify({ verified: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsErr } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['member_discount_code', 'member_discount_pct']);

    if (settingsErr || !settings) {
      console.error('DB error (settings):', settingsErr);
      return new Response(JSON.stringify({ verified: true, code: null, error: 'Code unavailable' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const map: Record<string, string> = {};
    for (const row of settings) map[row.key] = row.value;

    return new Response(JSON.stringify({
      verified: true,
      code: map['member_discount_code'] || null,
      discount: (map['member_discount_pct'] || '20') + '%',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ verified: false, error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});