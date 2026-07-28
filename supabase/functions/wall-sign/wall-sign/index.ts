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

    // 2. Load post
    const { data: post, error: postErr } = await SB.from("wall_posts")
      .select("*")
      .eq("id", post_id)
      .maybeSingle();

    if (postErr || !post) {
      return json({ error: "Post not found" }, 404);
    }

    // 3. Reject if not author
    if (String(post.member_id) !== String(member_id)) {
      return json({ error: "Only the author can sign this post" }, 403);
    }

    // 4. Reject if already signed
    if (post.display_mode === "signed") {
      return json({ error: "Post display mode is already signed" }, 409);
    }

    // 5. Update display_mode to 'signed'
    const { data: updatedPost, error: updateErr } = await SB.from("wall_posts")
      .update({
        display_mode: "signed"
      })
      .eq("id", post_id)
      .select(`
        *,
        author:member_profile_display(name, avatar_url)
      `)
      .single();

    if (updateErr || !updatedPost) {
      console.error("Update error:", updateErr);
      return json({ error: "Failed to sign post" }, 500);
    }

    // 6. Serialize and return
    const author_name = updatedPost.author?.[0]?.name || updatedPost.author?.name || null;
    const author_avatar_url = updatedPost.author?.[0]?.avatar_url || updatedPost.author?.avatar_url || null;

    const serialized = {
      id: updatedPost.id,
      body: updatedPost.body,
      status: updatedPost.status,
      pray_count: updatedPost.pray_count,
      amen_count: updatedPost.amen_count,
      created_at: updatedPost.created_at,
      answered_at: updatedPost.answered_at,
      answered_note: updatedPost.answered_note,
      display_mode: updatedPost.display_mode,
      author: { name: author_name || 'Steward', avatar_url: author_avatar_url },
      is_mine: true,
      pray_count_frozen: updatedPost.status === 'answered'
    };

    return json(serialized);

  } catch (err: any) {
    console.error("Error in wall-sign:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
