// ============================================================
// EDGE FUNCTION: skool-sync  (v2)
// Receives Skool membership events via Zapier.
//
// Skool's Zapier app has ONLY two triggers and NEITHER is a
// cancellation. This handles JOIN events only. Lapse/churn is
// handled by the weekly CSV reconcile, because Skool cannot
// emit that signal at all.
//
// Money lanes never cross: Skool status governs DISCOUNT
// PRICING only. baknd owns product billing and rebilling, so
// member_status must never gate shipping or fulfillment.
//
// AUTH: accepts ZAPIER_WEBHOOK_SECRET (preferred, dedicated to
// Zapier) OR BAKND_WEBHOOK_SECRET (fallback). Separate creds
// per integration: rotating one must never break the other.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function clean(v: unknown, max = 200): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/[\x00-\x1F\x7F]/g, "").slice(0, max);
  return s.length ? s : null;
}

// Zapier field keys sometimes carry stray whitespace ("event ").
// Normalise every key on the way in so a typo in the Zap UI
// cannot silently null out a field.
function normalizeKeys(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k.trim()] = v;
  return out;
}

function authorized(req: Request): boolean {
  const accepted = [
    Deno.env.get("ZAPIER_WEBHOOK_SECRET"),
    Deno.env.get("BAKND_WEBHOOK_SECRET"),
  ].filter((s): s is string => !!s && s.length > 0);
  if (accepted.length === 0) return false;

  const urlSecret = new URL(req.url).searchParams.get("secret")?.trim();
  const headerSecret = req.headers.get("x-webhook-secret")?.trim();
  return accepted.some((s) => s === urlSecret || s === headerSecret);
}

// Grace window: 35d on a 30d cycle. Skool's trigger is POLLING,
// not instant, so a slow Zap must never lapse a paying member.
const GRACE_DAYS = 35;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let raw: Record<string, unknown> = {};
  try {
    raw = await req.json();
  } catch (_e) {
    return json({ error: "invalid_json" }, 400);
  }
  const payload = normalizeKeys(raw);

  const event = clean(payload.event, 50) || "unknown";
  const email = clean(payload.email, 254)?.toLowerCase() || null;
  const skool_user_id = clean(payload.skool_user_id, 64);
  const skool_handle = clean(payload.skool_handle, 100);
  const first_name = clean(payload.first_name, 100);
  const last_name = clean(payload.last_name, 100);
  const joined_at = clean(payload.joined_at, 64);

  const idem = `skool:${event}:${skool_user_id || email || "unknown"}`;

  // Log raw BEFORE acting. Edge logs retain 24h; this survives.
  const { error: logErr } = await supabase.from("webhook_log").insert({
    source: "skool",
    event_type: event,
    idempotency_key: idem,
    payload,
    status: "received",
  });

  if (logErr) {
    if (logErr.code === "23505") {
      console.log(`Duplicate skool event ignored: ${idem}`);
      return json({ success: true, message: "duplicate_ignored", idempotency_key: idem });
    }
    console.warn("webhook_log insert failed (non-fatal):", logErr.message);
  }

  async function fail(reason: string, detail?: string) {
    await supabase.from("webhook_log")
      .update({ status: "error", error: `${reason}${detail ? ": " + detail : ""}` })
      .eq("idempotency_key", idem);
    return json({ error: reason, detail }, 400);
  }

  if (!skool_user_id && !email) {
    return await fail("missing_identity", "need skool_user_id or email");
  }

  // Only join events exist. Skool has no cancel trigger.
  const JOIN_EVENTS = new Set([
    "member_joined_paid",
    "member_upgraded_paid",
    "payment_succeeded",
  ]);

  if (!JOIN_EVENTS.has(event)) {
    await supabase.from("webhook_log")
      .update({ status: "ignored", error: `unsupported_event:${event}` })
      .eq("idempotency_key", idem);
    return json({ success: true, message: "event_ignored", event });
  }

  // Match on skool_user_id first (durable, survives email changes),
  // fall back to email. 18/52 Skool members have no email at all.
  let existing: Record<string, unknown> | null = null;

  if (skool_user_id) {
    const { data } = await supabase
      .from("approved_members")
      .select("*")
      .eq("skool_user_id", skool_user_id)
      .maybeSingle();
    existing = data ?? null;
  }

  if (!existing && email) {
    const { data } = await supabase
      .from("approved_members")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    existing = data ?? null;
  }

  const activeThrough = new Date(Date.now() + GRACE_DAYS * 864e5)
    .toISOString()
    .slice(0, 10);

  // Merge, never null out existing quiz/demographic data.
  const row: Record<string, unknown> = {
    member_status: "member",
    active: true,
    active_through: activeThrough,
    skool_user_id: skool_user_id || (existing?.skool_user_id as string) || null,
    skool_handle: skool_handle || (existing?.skool_handle as string) || null,
    skool_joined_at: joined_at || (existing?.skool_joined_at as string) || null,
  };

  const resolvedEmail = email || (existing?.email as string) || null;
  if (!resolvedEmail) {
    return await fail("no_email_available", "cannot upsert without an email key");
  }
  row.email = resolvedEmail;

  if (first_name || !existing?.name) row.name = first_name || existing?.name || "Steward";
  if (last_name || existing?.last_name) row.last_name = last_name || existing?.last_name || null;
  if (!existing) row.source = "skool";

  const { data: saved, error: upsertErr } = await supabase
    .from("approved_members")
    .upsert(row, { onConflict: "email" })
    .select("id, email, member_status, active_through, skool_user_id")
    .single();

  if (upsertErr) {
    console.error("upsert failed:", upsertErr.message);
    await supabase.from("webhook_log")
      .update({ status: "error", error: upsertErr.message })
      .eq("idempotency_key", idem);
    return json({ error: "db_error", detail: upsertErr.message }, 500);
  }

  // Joining the community means they are no longer a cold lead.
  // Skool runs its own follow-up every 3 days; do not duplicate.
  const nurtureSecret = Deno.env.get("NURTURE_WEBHOOK_SECRET");
  if (!nurtureSecret) {
    console.warn("Nurture cancellation refused: NURTURE_WEBHOOK_SECRET is not configured");
  } else {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cancel-nurture-sequence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": nurtureSecret,
        },
        body: JSON.stringify({ email: resolvedEmail }),
      });
    } catch (e) {
      console.warn("Cancel nurture sequence failed:", e);
    }
  }

  await supabase.from("webhook_log")
    .update({ status: "processed" })
    .eq("idempotency_key", idem);

  return json({
    success: true,
    event,
    matched_by: existing ? (skool_user_id && existing.skool_user_id ? "skool_user_id" : "email") : "created",
    member: saved,
  });
});
