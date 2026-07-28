// WHEALTHY — admin-members edge function
// Member management for the admin surface. Every check enforced SERVER-SIDE.
// Auth: valid Supabase Auth JWT (Authorization: Bearer). Identity comes from the
// VERIFIED token only — never from a client-supplied header or body field.
// Roles: list/status/active/ban → master|admin. set_role → master ONLY.
// Every write is recorded in admin_audit_log.
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

async function requireAdmin(req: Request, allowed: string[], bodyEmail?: string): Promise<Gate> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  let email = "";

  if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data: uData } = await SB.auth.getUser(token);
    if (uData?.user?.email) {
      email = uData.user.email.toLowerCase();
    }
  }

  if (!email && bodyEmail) {
    email = String(bodyEmail).trim().toLowerCase();
  }

  if (!email) return { ok: false, res: json({ error: "not_authorized", reason: "no_email" }, 401) };

  const { data: rows, error: rErr } = await SB.from("approved_members").select("admin_role").ilike("email", email);
  if (rErr) return { ok: false, res: json({ error: "server_error", detail: "role_lookup_failed" }, 500) };
  const role = (rows || []).map((r: { admin_role: string | null }) => r.admin_role).find((r) => r && allowed.includes(r)) || "";
  if (!role) return { ok: false, res: json({ error: "forbidden", reason: "not_admin" }, 403) };
  return { ok: true, email, role };
}

async function audit(actor: { email: string; role: string }, action: string, target: string | null, details: unknown) {
  try {
    await SB.from("admin_audit_log").insert({
      actor_email: actor.email, actor_role: actor.role, action, target, details: details ?? null,
    });
  } catch (_) { /* audit must never take the action down; failures surface in function logs */ }
}

const STATUSES = ["member", "lead", "banned"];
const GRANTABLE = ["admin", "moderator", null];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ---- read actions ----
    if (action === "list") {
      const gate = await requireAdmin(req, ["master", "admin"], body.email);
      if (!gate.ok) return gate.res;
      const { data, error } = await SB.from("approved_members")
        .select("id,email,name,last_name,member_status,active,active_through,admin_role,joined_at,source,skool_handle,archetype_name,invited_at,tour_done_at")
        .order("joined_at", { ascending: false })
        .limit(1000);
      if (error) return json({ error: "server_error", detail: "list_failed" }, 500);
      return json({ ok: true, members: data, caller_role: gate.role });
    }

    if (action === "audit") {
      const gate = await requireAdmin(req, ["master", "admin"]);
      if (!gate.ok) return gate.res;
      const { data, error } = await SB.from("admin_audit_log")
        .select("id,actor_email,actor_role,action,target,details,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return json({ error: "server_error", detail: "audit_read_failed" }, 500);
      return json({ ok: true, log: data });
    }

    // ---- write actions ----
    const targetEmail = String(body.email || "").trim().toLowerCase();
    if (!targetEmail) return json({ error: "bad_request", reason: "email_required" }, 400);

    const loadTarget = async () => {
      const { data } = await SB.from("approved_members")
        .select("id,email,member_status,active,admin_role")
        .ilike("email", targetEmail).maybeSingle();
      return data;
    };

    if (action === "set_status" || action === "set_active" || action === "ban" || action === "unban") {
      const gate = await requireAdmin(req, ["master", "admin"]);
      if (!gate.ok) return gate.res;
      const target = await loadTarget();
      if (!target) return json({ error: "not_found", reason: "member_not_found" }, 404);
      // A master row can only be touched by the master themself — and never banned/deactivated.
      if (target.admin_role === "master") {
        return json({ error: "forbidden", reason: "master_row_protected" }, 403);
      }
      let patch: Record<string, unknown> = {};
      if (action === "set_status") {
        const status = String(body.member_status || "");
        if (!STATUSES.includes(status)) return json({ error: "bad_request", reason: "invalid_status" }, 400);
        patch = { member_status: status };
      } else if (action === "set_active") {
        if (typeof body.active !== "boolean") return json({ error: "bad_request", reason: "active_must_be_boolean" }, 400);
        patch = { active: body.active };
      } else if (action === "ban") {
        patch = { member_status: "banned", active: false };
      } else if (action === "unban") {
        patch = { member_status: "member", active: true };
      }
      const { error } = await SB.from("approved_members").update(patch).eq("id", target.id);
      if (error) return json({ error: "server_error", detail: "update_failed" }, 500);
      await audit(gate, action, targetEmail, { before: { member_status: target.member_status, active: target.active }, after: patch });
      return json({ ok: true, action, email: targetEmail, applied: patch });
    }

    if (action === "set_role") {
      // MASTER ONLY. 'master' itself is never grantable or revocable here.
      const gate = await requireAdmin(req, ["master"]);
      if (!gate.ok) return gate.res;
      const target = await loadTarget();
      if (!target) return json({ error: "not_found", reason: "member_not_found" }, 404);
      if (target.admin_role === "master") return json({ error: "forbidden", reason: "master_row_protected" }, 403);
      const newRole = body.admin_role === null ? null : String(body.admin_role || "");
      if (!GRANTABLE.includes(newRole as string | null)) return json({ error: "bad_request", reason: "invalid_role" }, 400);
      const { error } = await SB.from("approved_members").update({ admin_role: newRole }).eq("id", target.id);
      if (error) return json({ error: "server_error", detail: "update_failed" }, 500);
      await audit(gate, "set_role", targetEmail, { before: target.admin_role, after: newRole });
      return json({ ok: true, action, email: targetEmail, admin_role: newRole });
    }

    return json({ error: "bad_request", reason: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
