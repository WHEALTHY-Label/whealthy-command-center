// ============================================================
// EDGE FUNCTION: trigger-nurture-sequence
// Deploy as: trigger-nurture-sequence
// Called after quiz completion (via add-member or Pabbly).
// Inserts 15 scheduled email rows into nurture_queue.
// v7: accepts Quiz Spec v2 pattern keys; maps them to the legacy
//     content series send-nurture-email has copy for; honors the
//     skeptical flag by routing to the skeptical-steward series.
// v8: skip-check now uses member_status ('member') instead of the
//     active flag. active DEFAULTS TO TRUE for every new row, so the
//     old check skipped nurture for 100% of quiz leads since launch.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Timing offsets from quiz completion (in milliseconds)
const SCHEDULE_OFFSETS_MS: number[] = [
  30 * 60 * 1000,             // Email 1:  +30 minutes
  4 * 60 * 60 * 1000,         // Email 2:  +4 hours
  18 * 60 * 60 * 1000,        // Email 3:  +18 hours (Day 1 evening)
  48 * 60 * 60 * 1000,        // Email 4:  Day 2
  72 * 60 * 60 * 1000,        // Email 5:  Day 3
  96 * 60 * 60 * 1000,        // Email 6:  Day 4
  120 * 60 * 60 * 1000,       // Email 7:  Day 5
  168 * 60 * 60 * 1000,       // Email 8:  Day 7
  216 * 60 * 60 * 1000,       // Email 9:  Day 9
  264 * 60 * 60 * 1000,       // Email 10: Day 11
  312 * 60 * 60 * 1000,       // Email 11: Day 13
  360 * 60 * 60 * 1000,       // Email 12: Day 15
  432 * 60 * 60 * 1000,       // Email 13: Day 18
  504 * 60 * 60 * 1000,       // Email 14: Day 21
  672 * 60 * 60 * 1000,       // Email 15: Day 28
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1. Validate webhook secret
    const SECRET = Deno.env.get("NURTURE_WEBHOOK_SECRET");
    if (!SECRET) {
      return new Response(JSON.stringify({ error: "nurture_webhook_secret_not_configured" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const headerSecret = req.headers.get("x-webhook-secret");
    const urlSecret = new URL(req.url).searchParams.get("secret");
    if (headerSecret !== SECRET && urlSecret !== SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2. Parse payload
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const first_name = (body.first_name || "").trim();
    const archetype_key = (body.archetype_key || "").trim();
    const bundle_key = (body.bundle_key || "").trim() || null;

    if (!email || !archetype_key) {
      return new Response(JSON.stringify({ error: "email and archetype_key required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const VALID_ARCHETYPES = new Set([
      "owned-by-caffeine", "wired-but-scattered", "sharp-until-2pm",
      "running-on-fumes", "skeptical-steward",
      // Quiz Spec v2 pattern keys
      "morning-dependency", "energy-without-aim", "low-floor", "holding-it-together"
    ]);
    if (!VALID_ARCHETYPES.has(archetype_key)) {
      return new Response(JSON.stringify({ error: "invalid archetype_key" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Map v2 patterns to the legacy content series that send-nurture-email has copy for.
    // Written v2-native email copy can replace this map later without schema changes.
    const CONTENT_KEY_MAP: Record<string, string> = {
      "morning-dependency": "owned-by-caffeine",
      "energy-without-aim": "wired-but-scattered",
      "low-floor": "running-on-fumes",
      "holding-it-together": "sharp-until-2pm",
    };
    let content_key = CONTENT_KEY_MAP[archetype_key] || archetype_key;
    if (body.skeptical === true) content_key = "skeptical-steward";

    // 3. Init Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Check if already a community member.
    // NOTE: approved_members.active DEFAULTS TO TRUE for every row, including
    // brand-new quiz leads add-member upserts moments before calling this
    // function - which silently skipped nurture for 100% of leads. member_status
    // is the reliable signal: 'lead' (quiz only) vs 'member' (joined community).
    const { data: member } = await supabase
      .from("approved_members")
      .select("email, active, member_status")
      .ilike("email", email)
      .maybeSingle();

    if (member?.member_status === "member") {
      console.log(`Nurture skipped: ${email} is already a community member.`);
      return new Response(JSON.stringify({
        success: true,
        message: "skipped_active_member",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 5. Check for existing nurture sequence (no restart)
    const { data: existing } = await supabase
      .from("nurture_queue")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`Nurture skipped: ${email} already has a sequence in progress.`);
      return new Response(JSON.stringify({
        success: true,
        message: "sequence_already_exists",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 6. Calculate scheduled_at for each of the 15 positions
    const now = Date.now();
    const rows = SCHEDULE_OFFSETS_MS.map((offset, i) => ({
      email,
      first_name: first_name || null,
      archetype_key: content_key,
      bundle_key,
      position: i + 1,
      scheduled_at: new Date(now + offset).toISOString(),
    }));

    // 7. Insert all 15 rows
    const { error: insertErr } = await supabase
      .from("nurture_queue")
      .insert(rows);

    if (insertErr) {
      console.error("Failed to insert nurture queue:", insertErr.message);
      return new Response(JSON.stringify({ error: "insert_failed", detail: insertErr.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log(`Nurture sequence created for ${email} (${archetype_key} -> ${content_key}): 15 emails scheduled.`);

    return new Response(JSON.stringify({
      success: true,
      message: "nurture_sequence_created",
      email,
      archetype_key,
      content_key,
      emails_scheduled: 15,
      first_send: rows[0].scheduled_at,
      last_send: rows[14].scheduled_at,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
