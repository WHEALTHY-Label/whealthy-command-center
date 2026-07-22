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
    const { member_id, post_id } = await req.json();

    // 1. Validate member
    const { data: member, error: memberErr } = await SB.from("approved_members")
      .select("id")
      .eq("id", member_id)
      .maybeSingle();

    if (memberErr || !member) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (!post_id) {
      return json({ error: "post_id is required" }, 400);
    }

    // 2. Call our database transaction
    const { data: txResult, error: txErr } = await SB.rpc("wall_amen_transaction", {
      p_post_id: post_id,
      p_member_id: member_id
    });

    if (txErr) {
      console.error("RPC Error:", txErr);
      return json({ error: "Failed to record amen" }, 500);
    }

    const { error, status, amen_count, has_amened } = txResult || {};
    if (error) {
      return json({ error }, status || 400);
    }

    return json({ amen_count, has_amened });

  } catch (err: any) {
    console.error("Error in wall-amen:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
