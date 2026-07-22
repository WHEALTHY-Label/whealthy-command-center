import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Rate limiter: max 100 events per session per 5 minutes
const rateLimitMap = new Map<string, { count: number; firstHit: number }>();
const RL_WINDOW = 5 * 60 * 1000;
const RL_MAX = 100;

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);
  if (!entry || (now - entry.firstHit) > RL_WINDOW) {
    rateLimitMap.set(sessionId, { count: 1, firstHit: now });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

function clean(val: unknown, maxLen = 200): string | null {
  if (val == null) return null;
  const s = String(val).trim().replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen);
  return s.length > 0 ? s : null;
}

const VALID_EVENTS = new Set([
  'page_view',
  'section_visible',
  'scroll_depth',
  'quiz_open',
  'quiz_question',
  'quiz_secondary',
  'quiz_contact_form',
  'quiz_complete',
  'quiz_drop_off',
  'cta_click',
  'proof_toast_shown',
  'time_on_page'
]);

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
    // Reject oversized payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 20000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Support single event or batch (array of events)
    const events: unknown[] = Array.isArray(body) ? body : [body];

    // Cap batch size
    if (events.length > 20) {
      return new Response(JSON.stringify({ error: 'Max 20 events per batch' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows: Record<string, unknown>[] = [];

    for (const evt of events) {
      if (!evt || typeof evt !== 'object') continue;
      const e = evt as Record<string, unknown>;

      const session_id = clean(e.session_id, 64);
      if (!session_id) continue;

      // Rate limit per session
      if (isRateLimited(session_id)) continue;

      const event_type = clean(e.event_type, 50);
      if (!event_type || !VALID_EVENTS.has(event_type)) continue;

      // Sanitize event_data: must be object, cap serialized size
      let event_data: Record<string, unknown> = {};
      if (e.event_data && typeof e.event_data === 'object' && !Array.isArray(e.event_data)) {
        const serialized = JSON.stringify(e.event_data);
        if (serialized.length <= 2000) {
          event_data = e.event_data as Record<string, unknown>;
        }
      }

      const page = clean(e.page, 500) || '/';
      const referral_code = clean(e.referral_code, 20);

      // Device type from viewport width
      const viewport_width = typeof e.viewport_width === 'number' && e.viewport_width > 0 && e.viewport_width < 10000
        ? Math.round(e.viewport_width) : null;

      let device_type: string | null = null;
      if (viewport_width) {
        if (viewport_width <= 480) device_type = 'mobile_small';
        else if (viewport_width <= 768) device_type = 'mobile';
        else if (viewport_width <= 1024) device_type = 'tablet';
        else device_type = 'desktop';
      }

      const time_on_page = typeof e.time_on_page === 'number' && e.time_on_page >= 0 && e.time_on_page < 3600000
        ? Math.round(e.time_on_page) : null;

      rows.push({
        session_id,
        event_type,
        event_data,
        page,
        referral_code,
        device_type,
        viewport_width,
        time_on_page,
      });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ saved: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase.from('page_events').insert(rows);

    if (error) {
      console.error('DB error:', error);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ saved: rows.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});