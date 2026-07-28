// ============================================================
// EDGE FUNCTION: order-sync  (v2)
// Receives baknd order updates via Zapier (WebConnect ->
// Updated Order trigger).
//
// WHY THIS EXISTS:
// baknd rebills product subscriptions autonomously every 30d.
// WebConnect exposes NO subscription lifecycle triggers, so a
// FAILED REBILL is invisible to every other part of the stack.
// baknd flips the order to unpaid on a failed rebill. This is
// the only window into that event.
//
// WHAT IT IGNORES:
// - Refunds. Issued in Stripe, not baknd. Never reach here.
// - Manual status changes (pending/shipped/completed). Those
//   are Jake's own keystrokes echoed back. Logged, not acted on.
//
// AUTH: accepts ZAPIER_WEBHOOK_SECRET (preferred) OR
// BAKND_WEBHOOK_SECRET (fallback).
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

// Zapier sends booleans as the strings "true"/"false".
function asBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  const s = clean(v, 10)?.toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return null;
}

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

  const order_id = clean(payload.order_id ?? payload.id, 64);
  const email = clean(payload.email ?? payload.customerEmail, 254)?.toLowerCase() || null;
  const order_status = clean(payload.status ?? payload.order_status, 50)?.toLowerCase() || null;
  const order_paid = asBool(payload.order_paid ?? payload.paid);
  const total = clean(payload.total ?? payload.order_total, 20);

  // Idempotency includes state, so a genuine state CHANGE processes
  // while a literal replay of the same state does not.
  const idem = `baknd:order:${order_id}:${order_status ?? "na"}:${order_paid ?? "na"}`;

  const { error: logErr } = await supabase.from("webhook_log").insert({
    source: "baknd",
    event_type: "order_updated",
    idempotency_key: idem,
    payload,
    status: "received",
  });

  if (logErr) {
    if (logErr.code === "23505") {
      console.log(`Duplicate order update ignored: ${idem}`);
      return json({ success: true, message: "duplicate_ignored", idempotency_key: idem });
    }
    console.warn("webhook_log insert failed (non-fatal):", logErr.message);
  }

  async function finish(status: string, note: string, body: Record<string, unknown>) {
    await supabase.from("webhook_log")
      .update({ status, error: note })
      .eq("idempotency_key", idem);
    return json({ success: true, ...body });
  }

  if (!order_id && !email) {
    return await finish("error", "missing_identity", {
      success: false,
      message: "need order_id or email",
    });
  }

  // ---- THE ONLY ACTIONABLE SIGNALS ----
  // 1. order_paid === false  -> failed rebill. The event that matters.
  // 2. status === canceled   -> order killed.
  // Everything else is a manual status change: log and ignore.
  const isFailedPayment = order_paid === false;
  const isCanceled = order_status === "canceled" || order_status === "cancelled";

  if (!isFailedPayment && !isCanceled) {
    return await finish("ignored", `no_action:status=${order_status},paid=${order_paid}`, {
      message: "logged_no_action",
      order_id,
      order_status,
      order_paid,
    });
  }

  const reason = isFailedPayment ? "payment_failed" : "order_canceled";
  const actions: string[] = [];

  if (email) {
    // Void the most recent UNSHIPPED order. Never touch a shipped
    // one: the product is already gone.
    const { data: recentOrder } = await supabase
      .from("bundle_orders")
      .select("id, status, shipped_at")
      .ilike("email", email)
      .is("shipped_at", null)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentOrder) {
      const { error: voidErr } = await supabase
        .from("bundle_orders")
        .update({ status: "voided" })
        .eq("id", recentOrder.id);
      if (!voidErr) actions.push(`voided_bundle_order:${recentOrder.id}`);
      else console.error("void failed:", voidErr.message);
    }

    // Pause the standing subscription so nothing else ships on a
    // dead card. baknd owns billing; this stops OUR side.
    const { data: sub } = await supabase
      .from("bundle_subscriptions")
      .select("id, status")
      .ilike("email", email)
      .maybeSingle();

    if (sub && sub.status === "active") {
      const { error: pauseErr } = await supabase
        .from("bundle_subscriptions")
        .update({
          status: "paused",
          auto_order: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      if (!pauseErr) actions.push(`paused_subscription:${sub.id}`);
      else console.error("pause failed:", pauseErr.message);
    }
  }

  // NOTE: Shopify cancellation is deliberately NOT automated.
  // Supliful may already be picking. Voiding here flags it for a
  // human; auto-cancelling a live fulfillment is worse.
  console.log(`order-sync ${reason}: ${email} / order ${order_id} -> ${actions.join(", ") || "no_matching_records"}`);

  await supabase.from("webhook_log")
    .update({ status: "processed", error: `${reason}: ${actions.join(", ") || "no_matching_records"}` })
    .eq("idempotency_key", idem);

  return json({
    success: true,
    reason,
    order_id,
    email,
    total,
    actions,
    note: actions.length ? "Review Shopify manually if already fulfilled." : "No matching Supabase records found.",
  });
});
