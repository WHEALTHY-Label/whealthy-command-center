// ============================================================
// EDGE FUNCTION: cancel-nurture-sequence
// Deploy as: cancel-nurture-sequence
// Called when a contact joins the Skool community.
// Cancels all unsent nurture emails for that contact.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3. Init Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Cancel all unsent emails for this contact
    const { data: cancelled, error: cancelErr } = await supabase
      .from("nurture_queue")
      .update({
        cancelled: true,
        cancel_reason: "community_joined",
      })
      .ilike("email", email)
      .is("sent_at", null)
      .eq("cancelled", false)
      .select("id");

    if (cancelErr) {
      console.error("Failed to cancel nurture:", cancelErr.message);
      return new Response(JSON.stringify({ error: "cancel_failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const cancelledCount = cancelled?.length || 0;
    console.log(`Nurture cancelled for ${email}: ${cancelledCount} emails suppressed.`);

    // 5. Log cancellation event to page_events
    if (cancelledCount > 0) {
      await supabase.from("page_events").insert({
        event_type: "nurture_sequence_cancelled",
        page: "system",
        session_id: `nurture_cancel_${Date.now()}`,
        metadata: {
          email,
          emails_cancelled: cancelledCount,
          reason: "community_joined",
        },
      }).catch((e: Error) => console.warn("Event log failed:", e));
    }

    return new Response(JSON.stringify({
      success: true,
      message: "nurture_sequence_cancelled",
      email,
      emails_cancelled: cancelledCount,
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
