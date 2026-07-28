import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { reporter_id, post_id, reason } = await req.json();

    // 1. Validate member (reporter)
    const { data: member, error: memberErr } = await SB.from("approved_members")
      .select("id")
      .eq("id", reporter_id)
      .maybeSingle();

    if (memberErr || !member) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (!post_id) {
      return json({ error: "post_id is required" }, 400);
    }

    // 2. Validate reason length if provided
    const cleanReason = reason ? reason.trim() : null;
    if (cleanReason && cleanReason.length > 500) {
      return json({ error: "Reason cannot exceed 500 characters" }, 400);
    }

    // 3. Call database report transaction
    const { data: txResult, error: txErr } = await SB.rpc("wall_report_transaction", {
      p_post_id: post_id,
      p_reporter_id: reporter_id,
      p_reason: cleanReason
    });

    if (txErr) {
      console.error("RPC Error:", txErr);
      return json({ error: "Failed to submit report" }, 500);
    }

    const { error, status, reported } = txResult || {};
    if (error) {
      return json({ error }, status || 400);
    }

    return json({ reported });

  } catch (err: any) {
    console.error("Error in wall-report:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
