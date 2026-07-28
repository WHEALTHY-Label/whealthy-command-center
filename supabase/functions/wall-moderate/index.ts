// WHEALTHY — wall-moderate v5
// Moderation queue + uphold/dismiss for wall + testimony posts.
// SECURITY: the old x-admin-password shared secret is GONE. Auth is a valid
// Supabase Auth JWT whose account carries admin_role master|admin|moderator
// in approved_members (identity from the VERIFIED token only). Writes audited.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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
  } catch (_) { /* never let audit failure take moderation down */ }
}

const MOD_ROLES = ["master", "admin", "moderator"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const gate = await requireAdmin(req, MOD_ROLES);
    if (!gate.ok) return gate.res;

    if (req.method === "GET") {
      const { data: reports, error: reportsErr } = await SB
        .from("wall_reports")
        .select(`id, post_id, reason, created_at, reporter_id,
          post:wall_posts ( body, member_id, source, status, created_at )`)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (reportsErr) return json({ error: "Failed to fetch queue" }, 500);

      const postGroups: Record<string, any> = {};
      (reports || []).forEach((rep: any) => {
        const pId = rep.post_id;
        const postData = Array.isArray(rep.post) ? rep.post[0] : rep.post;
        if (!postGroups[pId]) {
          postGroups[pId] = {
            post_id: pId,
            body: postData?.body || "",
            author_member_id: postData?.member_id || null,
            source: postData?.source || null,
            report_count: 0,
            reasons: [],
            created_at: postData?.created_at || rep.created_at,
          };
        }
        postGroups[pId].report_count++;
        if (rep.reason) postGroups[pId].reasons.push({ reporter_id: rep.reporter_id, reason: rep.reason, created_at: rep.created_at });
      });
      const queue = Object.values(postGroups).sort((a: any, b: any) => b.report_count - a.report_count);
      return json({ queue, caller_role: gate.role });
    }

    if (req.method === "POST") {
      const { action, post_id } = await req.json();
      if (!post_id) return json({ error: "post_id is required" }, 400);
      if (!["dismiss", "uphold"].includes(action)) return json({ error: "Invalid action" }, 400);

      if (action === "dismiss") {
        const { data: post, error: postErr } = await SB.from("wall_posts")
          .select("answered_at").eq("id", post_id).maybeSingle();
        if (postErr || !post) return json({ error: "Post not found" }, 404);
        const priorStatus = post.answered_at ? "answered" : "live";
        await Promise.all([
          SB.from("wall_reports").update({ status: "dismissed", resolved_at: new Date().toISOString() })
            .eq("post_id", post_id).eq("status", "open"),
          SB.from("wall_posts").update({ status: priorStatus }).eq("id", post_id),
        ]);
        await audit(gate, "moderation_dismiss", String(post_id), { restored_status: priorStatus });
        return json({ success: true, action: "dismissed" });
      }

      if (action === "uphold") {
        await SB.from("wall_reports").update({ status: "upheld", resolved_at: new Date().toISOString() })
          .eq("post_id", post_id).eq("status", "open");
        await audit(gate, "moderation_uphold", String(post_id), null);
        return json({ success: true, action: "upheld" });
      }
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err?.message || "Internal Server Error" }, 500);
  }
});
