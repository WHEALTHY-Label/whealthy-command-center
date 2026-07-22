// WHEALTHY — admin-settings edge function
// Feature flags / site settings via the existing site_settings table.
// Auth: valid Supabase Auth JWT with admin_role master|admin (verified token only).
// Writes are master|admin, audited in admin_audit_log. Reads return all keys.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Gate = { ok: true; email: string; role: string } | { ok: false; res: Response };
async function requireAdmin(req: Request, allowed: string[]): Promise<Gate> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { ok: false, res: json({ error: "not_authorized", reason: "no_token" }, 401) };
  const { data: uData, error: uErr } = await SB.auth.getUser(token);
  const email = uData?.user?.email?.toLowerCase() || "";
  if (uErr || !email) return { ok: false, res: json({ error: "not_authorized", reason: "invalid_token" }, 401) };
  const { data: rows, error: rErr } = await SB.from("approved_members").select("admin_role").ilike("email", email);
  if (rErr) return { ok: false, res: json({ error: "server_error", detail: "role_lookup_failed" }, 500) };
  const role = (rows || []).map((r: { admin_role: string | null }) => r.admin_role).find((r) => r && allowed.includes(r)) || "";
  if (!role) return { ok: false, res: json({ error: "forbidden", reason: "not_admin" }, 403) };
  return { ok: true, email, role };
}
async function audit(actor: { email: string; role: string }, action: string, target: string | null, details: unknown) {
  try {
    await SB.from("admin_audit_log").insert({ actor_email: actor.email, actor_role: actor.role, action, target, details: details ?? null });
  } catch (_) { /* never let audit failure take the action down */ }
}

// Keys the admin UI presents as first-class flags (anything else still works, but these get labels).
const KNOWN = ["member_discount_code", "member_discount_pct", "AUTO_INVITE_ENABLED"];
const KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_VALUE_LEN = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const gate = await requireAdmin(req, ["master", "admin"]);
    if (!gate.ok) return gate.res;

    if (action === "list") {
      const { data, error } = await SB.from("site_settings").select("key,value,updated_at").order("key");
      if (error) return json({ error: "server_error", detail: "list_failed" }, 500);
      return json({ ok: true, settings: data, known: KNOWN, caller_role: gate.role });
    }

    if (action === "set") {
      const key = String(body.key || "").trim();
      if (!KEY_RE.test(key)) return json({ error: "bad_request", reason: "invalid_key" }, 400);
      if (typeof body.value !== "string" && typeof body.value !== "number" && typeof body.value !== "boolean") {
        return json({ error: "bad_request", reason: "value_required" }, 400);
      }
      const value = String(body.value);
      if (value.length > MAX_VALUE_LEN) return json({ error: "bad_request", reason: "value_too_long" }, 400);
      const { data: prev } = await SB.from("site_settings").select("value").eq("key", key).maybeSingle();
      const { error } = await SB.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) return json({ error: "server_error", detail: "set_failed" }, 500);
      await audit(gate, "setting_set", key, { before: prev?.value ?? null, after: value });
      return json({ ok: true, key, value });
    }

    if (action === "delete") {
      const key = String(body.key || "").trim();
      if (!KEY_RE.test(key)) return json({ error: "bad_request", reason: "invalid_key" }, 400);
      const { data: prev } = await SB.from("site_settings").select("value").eq("key", key).maybeSingle();
      if (!prev) return json({ error: "not_found", reason: "key_not_found" }, 404);
      const { error } = await SB.from("site_settings").delete().eq("key", key);
      if (error) return json({ error: "server_error", detail: "delete_failed" }, 500);
      await audit(gate, "setting_delete", key, { before: prev.value });
      return json({ ok: true, key, deleted: true });
    }

    return json({ error: "bad_request", reason: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
