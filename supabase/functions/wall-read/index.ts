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
    const { member_id, view, cursor = 0, limit = 10, post_id } = await req.json();

    // 1. Validate member exists
    const { data: member, error: memberErr } = await SB.from("approved_members")
      .select("id")
      .eq("id", member_id)
      .maybeSingle();

    if (memberErr || !member) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (!view) {
      return json({ error: "view parameter is required" }, 400);
    }

    const offset = Number(cursor);
    const pageSize = Number(limit);
    let rawPosts: any[] = [];

    // View Routing & Loading
    if (view === "bible365") {
      const { data, error } = await SB.from("wall_posts")
        .select("*, author:member_profile_display(name, avatar_url)")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      rawPosts = data || [];

    } else if (view === "most_prayed") {
      const { data, error } = await SB.from("wall_posts_with_score")
        .select("*, author:member_profile_display(name, avatar_url)")
        .eq("status", "live")
        .order("score", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      rawPosts = data || [];

    } else if (view === "needs_prayer") {
      const { data, error } = await SB.from("wall_posts")
        .select("*, author:member_profile_display(name, avatar_url)")
        .eq("status", "live")
        .order("pray_count", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      rawPosts = data || [];

    } else if (view === "testimony_top") {
      const { data: topList, error } = await SB.rpc("get_wall_top_testimonies_json", { p_limit: 11 });
      if (error) throw error;
      rawPosts = topList || [];

    } else if (view === "testimony_river") {
      const { data, error } = await SB.from("wall_posts")
        .select("*, author:member_profile_display(name, avatar_url)")
        .eq("status", "answered")
        .order("answered_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      rawPosts = data || [];

    } else if (view === "my_prayers") {
      const { data, error } = await SB.from("wall_posts")
        .select("*, author:member_profile_display(name, avatar_url)")
        .eq("member_id", member_id)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      rawPosts = data || [];

    } else if (view === "praying_for") {
      const { data: prayingList, error } = await SB.rpc("get_my_praying_for_posts", {
        p_member_id: member_id,
        p_limit: pageSize,
        p_offset: offset
      });
      if (error) throw error;
      rawPosts = prayingList || [];

    } else if (view === "single") {
      if (!post_id) {
        return json({ error: "post_id is required for single view" }, 400);
      }
      const { data, error } = await SB.from("wall_posts")
        .select("*, author:member_profile_display(name, avatar_url)")
        .eq("id", post_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "Post not found" }, 404);
      rawPosts = [data];

    } else {
      return json({ error: "Invalid view parameter" }, 400);
    }

    // Fetch viewer state (prays and amens) in parallel
    const postIds = rawPosts.map(p => p.id);
    const hasLive = rawPosts.some(p => p.status === 'live');
    const hasAnswered = rawPosts.some(p => p.status === 'answered');

    const queries: Promise<any>[] = [];
    let praysPromiseIndex = -1;
    let amensPromiseIndex = -1;

    // Skip prays lookup if view is bible365 or no live posts present
    if (hasLive && view !== "bible365") {
      praysPromiseIndex = queries.length;
      queries.push(
        SB.from("wall_prays")
          .select("post_id")
          .eq("member_id", member_id)
          .in("post_id", postIds)
          .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      );
    }

    // Skip amens lookup if no answered posts present
    if (hasAnswered) {
      amensPromiseIndex = queries.length;
      queries.push(
        SB.from("wall_amens")
          .select("post_id")
          .eq("member_id", member_id)
          .in("post_id", postIds)
      );
    }

    const results = await Promise.all(queries);

    const praysMap: Record<string, number> = {};
    if (praysPromiseIndex !== -1) {
      const { data: userPrays } = results[praysPromiseIndex];
      (userPrays || []).forEach((wp: any) => {
        praysMap[wp.post_id] = (praysMap[wp.post_id] || 0) + 1;
      });
    }

    const amensMap: Record<string, boolean> = {};
    if (amensPromiseIndex !== -1) {
      const { data: userAmens } = results[amensPromiseIndex];
      (userAmens || []).forEach((wa: any) => {
        amensMap[wa.post_id] = true;
      });
    }

    // Helper: Shared serializer
    const serializePost = (post: any, viewer_member_id: any, isBibleView = false) => {
      const author_name = post.author_name || post.author?.[0]?.name || post.author?.name || null;
      const author_avatar_url = post.author_avatar_url || post.author?.[0]?.avatar_url || post.author?.avatar_url || null;
      const praysToday = praysMap[post.id] || 0;

      const base: any = {
        id: post.id,
        body: post.body,
        status: post.status,
        pray_count: post.pray_count,
        amen_count: post.amen_count,
        created_at: post.created_at,
        answered_at: post.answered_at,
        answered_note: post.answered_note,
        answered_note_locked_at: post.answered_note_locked_at,
        display_mode: post.display_mode,
        is_mine: String(post.member_id) === String(viewer_member_id),
        pray_count_frozen: post.status === 'answered',
        prays_remaining_today: Math.max(0, 3 - praysToday)
      };

      if (post.display_mode === 'signed') {
        base.author = { 
          name: author_name || 'Steward', 
          avatar_url: author_avatar_url 
        };
      } else {
        base.author = { name: "A Steward", avatar_url: null };
      }

      // Add has_amened only on answered posts
      if (post.status === 'answered') {
        base.has_amened = !!amensMap[post.id];
      }

      if (isBibleView) {
        if (base.author) delete base.author.avatar_url;
        delete base.pray_count;
      }

      if (post.has_unseen_answer !== undefined) {
        base.has_unseen_answer = post.has_unseen_answer;
      }

      return base;
    };

    const isBible = view === "bible365";
    const postsList = rawPosts.map(p => serializePost(p, member_id, isBible));

    if (view === "single") {
      return json(postsList[0]);
    }

    return json({ posts: postsList });

  } catch (err: any) {
    console.error("Error in wall-read:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
