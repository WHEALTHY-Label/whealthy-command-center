import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Accept referral_code via query param (GET) or body (POST)
    let referral_code = '';
    if (req.method === 'GET') {
      const url = new URL(req.url);
      referral_code = (url.searchParams.get('code') || '').trim();
    } else {
      const body = await req.json();
      referral_code = (body.referral_code || '').trim();
    }

    if (!referral_code || referral_code.length > 20) {
      return new Response(JSON.stringify({ error: 'Referral code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get ambassador
    const { data: ambassador, error: ambErr } = await supabase
      .from('ambassadors')
      .select('id, first_name, last_name, referral_code, tier, commission_rate, total_referrals, total_conversions, total_earned, total_paid, status, created_at')
      .eq('referral_code', referral_code)
      .single();

    if (ambErr || !ambassador) {
      return new Response(JSON.stringify({ error: 'Ambassador not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get recent referrals (last 30)
    const { data: recentReferrals } = await supabase
      .from('referrals')
      .select('id, status, referred_name, archetype, bundle_key, commission_amount, commission_status, created_at')
      .eq('ambassador_id', ambassador.id)
      .order('created_at', { ascending: false })
      .limit(30);

    // Get commission breakdown
    const { data: pendingCommissions } = await supabase
      .from('referrals')
      .select('commission_amount')
      .eq('ambassador_id', ambassador.id)
      .eq('commission_status', 'pending')
      .not('commission_amount', 'is', null);

    const { data: approvedCommissions } = await supabase
      .from('referrals')
      .select('commission_amount')
      .eq('ambassador_id', ambassador.id)
      .eq('commission_status', 'approved')
      .not('commission_amount', 'is', null);

    const pending_total = (pendingCommissions || []).reduce((sum, r) => sum + (r.commission_amount || 0), 0);
    const approved_total = (approvedCommissions || []).reduce((sum, r) => sum + (r.commission_amount || 0), 0);

    // Conversion rate
    const conversion_rate = ambassador.total_referrals > 0
      ? ((ambassador.total_conversions / ambassador.total_referrals) * 100).toFixed(1)
      : '0.0';

    return new Response(JSON.stringify({
      ambassador: {
        name: [ambassador.first_name, ambassador.last_name].filter(Boolean).join(' '),
        code: ambassador.referral_code,
        tier: ambassador.tier,
        commission_rate: ambassador.commission_rate,
        status: ambassador.status,
        member_since: ambassador.created_at,
      },
      stats: {
        total_clicks: ambassador.total_referrals,
        total_conversions: ambassador.total_conversions,
        conversion_rate: conversion_rate + '%',
        total_earned: ambassador.total_earned,
        total_paid: ambassador.total_paid,
        balance_pending: pending_total,
        balance_approved: approved_total,
        balance_unpaid: ambassador.total_earned - ambassador.total_paid,
      },
      recent_referrals: (recentReferrals || []).map(r => ({
        id: r.id,
        status: r.status,
        name: r.referred_name,
        archetype: r.archetype,
        bundle: r.bundle_key,
        commission: r.commission_amount,
        commission_status: r.commission_status,
        date: r.created_at,
      })),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});