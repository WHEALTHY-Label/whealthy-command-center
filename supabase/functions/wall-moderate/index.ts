import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-password, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  
  try {
    // Admin password gate
    const providedPassword = req.headers.get("x-admin-password");
    if (providedPassword !== "admin1234") {
      return json({ error: "Unauthorized" }, 401);
    }

    if (req.method === "GET") {
      // Fetch open reports queue
      const { data: reports, error: reportsErr } = await SB
        .from("wall_reports")
        .select(`
          id,
          post_id,
          reason,
          created_at,
          reporter_id,
          post:wall_posts (
            body,
            member_id,
            created_at
          )
        `)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (reportsErr) {
        console.error("Reports query error:", reportsErr);
        return json({ error: "Failed to fetch queue" }, 500);
      }

      // Group reports by post_id for admin presentation
      const postGroups: any = {};
      (reports || []).forEach((rep: any) => {
        const pId = rep.post_id;
        const postData = Array.isArray(rep.post) ? rep.post[0] : rep.post;
        if (!postGroups[pId]) {
          postGroups[pId] = {
            post_id: pId,
            body: postData?.body || "",
            author_member_id: postData?.member_id || null,
            report_count: 0,
            reasons: [],
            created_at: postData?.created_at || rep.created_at
          };
        }
        postGroups[pId].report_count++;
        if (rep.reason) {
          postGroups[pId].reasons.push({
            reporter_id: rep.reporter_id,
            reason: rep.reason,
            created_at: rep.created_at
          });
        }
      });

      const queue = Object.values(postGroups).sort((a: any, b: any) => b.report_count - a.report_count);
      return json({ queue });
    }

    if (req.method === "POST") {
      const { action, post_id } = await req.json();

      if (!post_id) {
        return json({ error: "post_id is required" }, 400);
      }

      if (!["dismiss", "uphold"].includes(action)) {
        return json({ error: "Invalid action" }, 400);
      }

      if (action === "dismiss") {
        // Restore status to prior state (answered or live)
        const { data: post, error: postErr } = await SB.from("wall_posts")
          .select("answered_at")
          .eq("id", post_id)
          .maybeSingle();

        if (postErr || !post) {
          return json({ error: "Post not found" }, 404);
        }

        const priorStatus = post.answered_at ? "answered" : "live";

        // Update post and reports in parallel
        await Promise.all([
          SB.from("wall_reports")
            .update({ status: "dismissed", resolved_at: new Date().toISOString() })
            .eq("post_id", post_id)
            .eq("status", "open"),
          SB.from("wall_posts")
            .update({ status: priorStatus })
            .eq("id", post_id)
        ]);

        return json({ success: true, action: "dismissed" });
      }

      if (action === "uphold") {
        // Resolve open reports as upheld; post remains 'held' permanently
        await SB.from("wall_reports")
          .update({ status: "upheld", resolved_at: new Date().toISOString() })
          .eq("post_id", post_id)
          .eq("status", "open");

        return json({ success: true, action: "upheld" });
      }
    }

    return json({ error: "Method not allowed" }, 405);

  } catch (err: any) {
    console.error("Error in wall-moderate:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
