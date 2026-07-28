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

    // 2. Stamp seen_answered_at = now()
    const { error } = await SB.from("wall_prays")
      .update({
        seen_answered_at: new Date().toISOString()
      })
      .eq("post_id", post_id)
      .eq("member_id", member_id)
      .is("seen_answered_at", null);

    if (error) {
      console.error("Seen stamp error:", error);
      return json({ error: "Failed to mark post answers as seen" }, 500);
    }

    return json({ success: true });

  } catch (err: any) {
    console.error("Error in wall-seen:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
