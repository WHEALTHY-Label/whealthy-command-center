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
    const { member_id, body, display_mode = 'anonymous', source } = await req.json();

    // 1. Validate member exists in approved_members
    const { data: member, error: memberErr } = await SB.from("approved_members")
      .select("id")
      .eq("id", member_id)
      .maybeSingle();

    if (memberErr || !member) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Validate body is 1 to 1000 chars after trim
    const cleanBody = (body || "").trim();
    if (cleanBody.length < 1 || cleanBody.length > 1000) {
      return json({ error: "Body must be between 1 and 1000 characters" }, 400);
    }

    // 3. Validate display_mode
    if (!['signed', 'anonymous'].includes(display_mode)) {
      return json({ error: "Invalid display_mode" }, 400);
    }

    // 4. Validate source
    if (!['bible365', 'wall'].includes(source)) {
      return json({ error: "Invalid source" }, 400);
    }

    // 5. Rate limit: count posts by this member_id where created_at > now() - interval '24 hours'
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await SB.from("wall_posts")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member_id)
      .gt("created_at", yesterday);

    if (countErr) {
      return json({ error: "Database error checking rate limit" }, 500);
    }

    if (count !== null && count >= 3) {
      return json({ error: "Rate limit exceeded. You can post up to 3 times per 24 hours." }, 429);
    }

    // 6. Insert post
    const { data: post, error: insertErr } = await SB.from("wall_posts")
      .insert({
        member_id,
        body: cleanBody,
        display_mode,
        source,
        status: "live",
        pray_count: 0,
        last_prayed_at: null
      })
      .select(`
        *,
        author:member_profile_display(name, avatar_url)
      `)
      .single();

    if (insertErr || !post) {
      console.error("Insert error:", insertErr);
      return json({ error: "Failed to create post" }, 500);
    }

    // 7. Serialize and return
    const author_name = post.author?.[0]?.name || post.author?.name || null;
    const author_avatar_url = post.author?.[0]?.avatar_url || post.author?.avatar_url || null;
    
    const serialized = {
      id: post.id,
      body: post.body,
      status: post.status,
      pray_count: post.pray_count,
      amen_count: post.amen_count,
      created_at: post.created_at,
      answered_at: post.answered_at,
      answered_note: post.answered_note,
      display_mode: post.display_mode,
      author: post.display_mode === 'signed' 
        ? { name: author_name || 'Steward', avatar_url: author_avatar_url }
        : { name: "A Steward", avatar_url: null },
      is_mine: true,
      pray_count_frozen: false
    };

    return json(serialized);

  } catch (err: any) {
    console.error("Error in wall-post:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
