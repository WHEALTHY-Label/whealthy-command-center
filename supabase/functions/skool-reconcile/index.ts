// ============================================================
// EDGE FUNCTION: skool-reconcile
//
// WHY THIS EXISTS:
// Skool's Zapier app has exactly TWO triggers (Answered
// Membership Questions, New Paid Member). NEITHER is a
// cancellation. Skool has no public API. members.json is
// cookie+WAF bound and cannot be called server-side.
// Therefore: Skool CANNOT tell us when someone leaves.
//
// The weekly CSV export is the only cancellation path that
// exists. This function ingests it and diffs BY ABSENCE:
// anyone marked 'member' in Supabase who is NOT in the CSV
// has left.
//
// STAKES ARE LOW BY DESIGN: Skool status governs DISCOUNT
// PRICING only. baknd owns product billing and rebilling, so
// a stale lapse costs a few dollars of margin once. It can
// never cause a wrong shipment.
//
// CSV columns (confirmed from real export):
//   FirstName, LastName, Email, Invited By, JoinedDate,
//   Question1-3, Answer1-3, Price, Recurring Interval, Tier, LTV
//
// KNOWN LIMIT: 18 of 52 rows have NO EMAIL (Skool-network
// joiners). Those rows are counted and skipped. We never lapse
// someone we cannot positively identify.
//
// POST body: { csv: "<raw csv text>", dry_run?: boolean }
// Auth: ZAPIER_WEBHOOK_SECRET or BAKND_WEBHOOK_SECRET
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

// RFC4180-ish parser: handles quoted fields and embedded commas.
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim().length > 0))
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
      return o;
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "invalid_json", hint: 'POST { "csv": "..." }' }, 400);
  }

  const csvText = typeof body.csv === "string" ? body.csv : "";
  const dryRun = body.dry_run === true;

  if (!csvText.trim()) {
    return json({ error: "missing_csv", hint: 'POST { "csv": "<raw export text>" }' }, 400);
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) return json({ error: "csv_parse_failed_or_empty" }, 400);

  // Sanity guard: a truncated/failed export must never mass-lapse
  // the whole community. 52 members today; anything under 5 rows
  // is far more likely a broken file than a real exodus.
  if (rows.length < 5) {
    return json({
      error: "csv_too_small",
      rows_parsed: rows.length,
      hint: "Refusing to reconcile: this looks like a truncated export, not a real member list.",
    }, 400);
  }

  // Build the present-set. Email is the only usable key.
  const csvEmails = new Set<string>();
  let blankEmailRows = 0;
  const paidEmails = new Set<string>();

  for (const r of rows) {
    const email = (r["Email"] || "").trim().toLowerCase();
    if (!email) { blankEmailRows++; continue; }
    csvEmails.add(email);

    // Price/Recurring Interval/LTV present => paying member.
    const price = (r["Price"] || "").trim();
    const ltv = (r["LTV"] || "").replace(/[$\s]/g, "");
    if (price || (ltv && ltv !== "0")) paidEmails.add(email);
  }

  // Everyone Supabase currently believes is a member.
  const { data: currentMembers, error: qErr } = await supabase
    .from("approved_members")
    .select("id, email, member_status, active_through")
    .eq("member_status", "member");

  if (qErr) return json({ error: "query_failed", detail: qErr.message }, 500);

  // DIFF BY ABSENCE. Present in Supabase as member, missing from
  // the CSV => they left Skool.
  const toLapse = (currentMembers || []).filter(
    (m) => !csvEmails.has((m.email || "").toLowerCase()),
  );

  const result = {
    dry_run: dryRun,
    csv_rows: rows.length,
    csv_emails: csvEmails.size,
    csv_blank_email_rows: blankEmailRows,
    csv_paid_members: paidEmails.size,
    supabase_members_before: currentMembers?.length ?? 0,
    lapsed_count: toLapse.length,
    lapsed_emails: toLapse.map((m) => m.email),
  };

  if (dryRun) {
    return json({ success: true, message: "dry_run_no_changes_written", ...result });
  }

  if (toLapse.length > 0) {
    const ids = toLapse.map((m) => m.id);
    const { error: upErr } = await supabase
      .from("approved_members")
      .update({ member_status: "lapsed", active: false })
      .in("id", ids);
    if (upErr) return json({ error: "lapse_update_failed", detail: upErr.message }, 500);

    // Skool status governs DISCOUNT PRICING only. Leaving the
    // community must NEVER stop a paid product subscription:
    // baknd owns that billing and they are still paying.
    // bundle_subscriptions is deliberately untouched here.
  }

  await supabase.from("webhook_log").insert({
    source: "skool_csv",
    event_type: "reconcile",
    idempotency_key: `skool:reconcile:${new Date().toISOString().slice(0, 10)}:${csvEmails.size}:${toLapse.length}`,
    payload: result,
    status: "processed",
  });

  return json({ success: true, ...result });
});
