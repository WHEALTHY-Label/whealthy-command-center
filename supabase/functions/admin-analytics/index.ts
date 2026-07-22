import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-admin-email',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SB_AUTH = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---- AUTH GATE ----
// Require a valid Supabase Auth JWT (Authorization: Bearer) whose account email
// carries admin_role 'master' or 'admin'. Identity comes from the VERIFIED token only,
// never from a client-supplied header or body field.
async function requireAdmin(
  req: Request,
): Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return { ok: false, res: jsonRes({ error: 'not_authorized', reason: 'no_token' }, 401) };
  const { data: uData, error: uErr } = await SB_AUTH.auth.getUser(token);
  const email = uData?.user?.email?.toLowerCase() || '';
  if (uErr || !email) return { ok: false, res: jsonRes({ error: 'not_authorized', reason: 'invalid_token' }, 401) };
  const { data: rows, error: rErr } = await SB_AUTH.from('approved_members').select('admin_role').ilike('email', email);
  if (rErr) return { ok: false, res: jsonRes({ error: 'server_error', detail: 'role_lookup_failed' }, 500) };
  const isAdmin = (rows || []).some((r: { admin_role: string | null }) => r.admin_role === 'master' || r.admin_role === 'admin');
  if (!isAdmin) return { ok: false, res: jsonRes({ error: 'forbidden', reason: 'not_admin' }, 403) };
  return { ok: true, email };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.res;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ===== APPROVED MEMBERS =====
    const { count: totalMembers } = await supabase
      .from('approved_members')
      .select('*', { count: 'exact', head: true });

    const { count: quizCompletions } = await supabase
      .from('approved_members')
      .select('*', { count: 'exact', head: true })
      .not('archetype', 'is', null);

    const { data: members } = await supabase
      .from('approved_members')
      .select('id, name, last_name, email, joined_at, source, archetype, archetype_name, identity_anchor, bundle_key, bundle_name, scores, answers, phone, referred_by')
      .order('joined_at', { ascending: false });

    const allMembers = members || [];
    const archetypeCounts: Record<string, number> = {};
    const bundleCounts: Record<string, number> = {};
    const anchorCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    let referralCount = 0;

    for (const m of allMembers) {
      if (m.archetype) archetypeCounts[m.archetype] = (archetypeCounts[m.archetype] || 0) + 1;
      if (m.bundle_key) bundleCounts[m.bundle_key] = (bundleCounts[m.bundle_key] || 0) + 1;
      if (m.identity_anchor) anchorCounts[m.identity_anchor] = (anchorCounts[m.identity_anchor] || 0) + 1;
      if (m.source) sourceCounts[m.source] = (sourceCounts[m.source] || 0) + 1;
      if (m.referred_by) referralCount++;
      if (m.joined_at) { const day = m.joined_at.split('T')[0]; dailyCounts[day] = (dailyCounts[day] || 0) + 1; }
    }

    const dailySubmissions = Object.entries(dailyCounts).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    const today = new Date().toISOString().split('T')[0];
    const todayCount = dailyCounts[today] || 0;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thisWeekCount = Object.entries(dailyCounts).filter(([date]) => date >= weekAgo).reduce((sum, [, count]) => sum + count, 0);

    // ===== PAGE EVENTS =====
    const { data: pageEvents } = await supabase
      .from('page_events')
      .select('session_id, event_type, event_data, device_type, viewport_width, time_on_page, referral_code, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    const events = pageEvents || [];
    const uniqueSessions = new Set(events.map(e => e.session_id));
    const totalSessions = uniqueSessions.size;

    // Event type counts
    const eventCounts: Record<string, number> = {};
    for (const e of events) {
      eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
    }

    // Page views (unique sessions with page_view)
    const pageViewSessions = new Set(events.filter(e => e.event_type === 'page_view').map(e => e.session_id));
    const pageViews = pageViewSessions.size;

    // Daily page views
    const dailyPageViews: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === 'page_view' && e.created_at) {
        const day = e.created_at.split('T')[0];
        dailyPageViews[day] = (dailyPageViews[day] || 0) + 1;
      }
    }
    const dailyPVList = Object.entries(dailyPageViews).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // Quiz funnel
    const quizOpenSessions = new Set(events.filter(e => e.event_type === 'quiz_open').map(e => e.session_id)).size;
    const quizCompleteSessions = new Set(events.filter(e => e.event_type === 'quiz_complete').map(e => e.session_id)).size;
    const quizDropOffSessions = new Set(events.filter(e => e.event_type === 'quiz_drop_off').map(e => e.session_id)).size;
    const quizContactSessions = new Set(events.filter(e => e.event_type === 'quiz_contact_form').map(e => e.session_id)).size;

    // Section visibility funnel
    const sectionCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === 'section_visible' && e.event_data?.section) {
        sectionCounts[e.event_data.section] = (sectionCounts[e.event_data.section] || 0) + 1;
      }
    }

    // Quiz question drop-off
    const questionCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === 'quiz_question' && e.event_data?.question !== undefined) {
        const qKey = 'Q' + e.event_data.question;
        questionCounts[qKey] = (questionCounts[qKey] || 0) + 1;
      }
    }

    // Drop-off by question
    const dropOffByQ: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === 'quiz_drop_off' && e.event_data?.last_question !== undefined) {
        const qKey = 'Q' + e.event_data.last_question;
        dropOffByQ[qKey] = (dropOffByQ[qKey] || 0) + 1;
      }
    }

    // Scroll depth
    const scrollDepths: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === 'scroll_depth' && e.event_data?.depth) {
        const key = e.event_data.depth + '%';
        scrollDepths[key] = (scrollDepths[key] || 0) + 1;
      }
    }

    // Device breakdown
    const deviceCounts: Record<string, number> = {};
    const sessionDevices = new Map<string, string>();
    for (const e of events) {
      if (e.device_type && !sessionDevices.has(e.session_id)) {
        sessionDevices.set(e.session_id, e.device_type);
      }
    }
    for (const [, dtype] of sessionDevices) {
      deviceCounts[dtype] = (deviceCounts[dtype] || 0) + 1;
    }

    // CTA clicks by location
    const ctaClicks: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === 'cta_click' && e.event_data?.location) {
        ctaClicks[e.event_data.location] = (ctaClicks[e.event_data.location] || 0) + 1;
      }
    }

    // Avg time on page (max per session from time_on_page events)
    const sessionMaxTime = new Map<string, number>();
    for (const e of events) {
      if (e.event_type === 'time_on_page' && e.event_data?.seconds) {
        const cur = sessionMaxTime.get(e.session_id) || 0;
        if (e.event_data.seconds > cur) sessionMaxTime.set(e.session_id, e.event_data.seconds);
      }
    }
    const timeVals = [...sessionMaxTime.values()];
    const avgTimeOnPage = timeVals.length ? Math.round(timeVals.reduce((a, b) => a + b, 0) / timeVals.length) : 0;

    // Referred sessions
    const referredSessions = new Set(events.filter(e => e.referral_code).map(e => e.session_id)).size;

    return new Response(JSON.stringify({
      summary: {
        total_members: totalMembers || 0,
        quiz_completions: quizCompletions || 0,
        today: todayCount,
        this_week: thisWeekCount,
        referral_driven: referralCount,
      },
      archetype_distribution: archetypeCounts,
      bundle_distribution: bundleCounts,
      anchor_distribution: anchorCounts,
      source_distribution: sourceCounts,
      daily_submissions: dailySubmissions,
      recent_submissions: allMembers.slice(0, 50).map(m => ({
        id: m.id, name: [m.name, m.last_name].filter(Boolean).join(' '),
        email: m.email, phone: m.phone, joined_at: m.joined_at,
        archetype: m.archetype, archetype_name: m.archetype_name,
        identity_anchor: m.identity_anchor, bundle_key: m.bundle_key,
        bundle_name: m.bundle_name, source: m.source,
        referred_by: m.referred_by, scores: m.scores, answers: m.answers,
      })),
      page_analytics: {
        total_sessions: totalSessions,
        page_views: pageViews,
        daily_page_views: dailyPVList,
        event_counts: eventCounts,
        quiz_funnel: {
          page_views: pageViews,
          quiz_opens: quizOpenSessions,
          contact_form: quizContactSessions,
          quiz_completes: quizCompleteSessions,
          quiz_drop_offs: quizDropOffSessions,
        },
        section_visibility: sectionCounts,
        quiz_question_counts: questionCounts,
        quiz_drop_off_by_question: dropOffByQ,
        scroll_depths: scrollDepths,
        device_breakdown: deviceCounts,
        cta_clicks: ctaClicks,
        avg_time_on_page: avgTimeOnPage,
        referred_sessions: referredSessions,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
