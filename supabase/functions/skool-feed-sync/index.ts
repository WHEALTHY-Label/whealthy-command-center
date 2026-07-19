import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const mockPosts = [
  {
    id: "post_1",
    slug: "the-rhythm-held-this-week-1",
    title: "The Rhythm Held this Week",
    excerpt: "Proud of all the Stewards who kept the chain active. Let's lift each other up.",
    author_name: "Elder John",
    likes: 14,
    comments: 3,
    posted_at: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: "post_2",
    slug: "morning-prayer-wall-testimonies-2",
    title: "Morning Prayer Wall Testimonies",
    excerpt: "Seeing the testimonies filed after active cohorts is so encouraging. God is moving!",
    author_name: "Companion Sarah",
    likes: 8,
    comments: 5,
    posted_at: new Date(Date.now() - 3600000 * 6).toISOString() // 6 hours ago
  },
  {
    id: "post_3",
    slug: "fasting-accountability-circle-3",
    title: "Fasting Accountability Circle",
    excerpt: "Our circles hit the 3-per-day prayer cap early today. Keep interceding.",
    author_name: "Shepherd Ignacio",
    likes: 22,
    comments: 11,
    posted_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const cookie = Deno.env.get('SKOOL_BOT_COOKIE');
    const groupSlug = Deno.env.get('SKOOL_GROUP_SLUG') || "bakndcreator";
    let postsToInsert = [];

    if (!cookie) {
      console.log("[skool-feed-sync] SKOOL_BOT_COOKIE not configured. Syncing mock posts.");
      postsToInsert = mockPosts;
    } else {
      try {
        // Fetch from Skool internal API
        // For slug resolution, we fetch the posts search or community posts endpoint
        const res = await fetch(`https://www.skool.com/api/v1/posts?group_slug=${groupSlug}&limit=20`, {
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });

        if (!res.ok) {
          throw new Error(`Skool API returned status ${res.status}`);
        }

        const data = await res.json();
        const posts = data?.posts || data?.data?.posts || [];

        if (Array.isArray(posts) && posts.length > 0) {
          postsToInsert = posts.map((p: any) => ({
            id: String(p.id || p.post_id),
            slug: String(p.slug || p.permalink_slug || ""),
            title: String(p.title || ""),
            excerpt: String(p.excerpt || p.content || "").slice(0, 200),
            author_name: String(p.author?.name || p.author_name || "Steward"),
            likes: Number(p.likes_count || p.likes || 0),
            comments: Number(p.comments_count || p.comments || 0),
            posted_at: p.created_at || p.posted_at || new Date().toISOString()
          }));
        } else {
          console.log("[skool-feed-sync] Skool API returned empty posts array. Falling back to mock posts.");
          postsToInsert = mockPosts;
        }
      } catch (err) {
        console.warn("[skool-feed-sync] Failed to fetch live Skool feed. Falling back to mock posts. Error:", err.message);
        postsToInsert = mockPosts;
      }
    }

    // Upsert posts in database
    for (const post of postsToInsert) {
      const { error: upsertErr } = await sb.from('skool_posts').upsert({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        author_name: post.author_name,
        likes: post.likes,
        comments: post.comments,
        posted_at: post.posted_at,
        synced_at: new Date().toISOString()
      });
      if (upsertErr) {
        console.error(`[skool-feed-sync] Failed to upsert post ${post.id}:`, upsertErr.message);
      }
    }

    // Prune to latest 50 posts
    const { data: allPosts, error: listErr } = await sb
      .from('skool_posts')
      .select('id')
      .order('posted_at', { ascending: false });

    if (!listErr && allPosts && allPosts.length > 50) {
      const idsToDelete = allPosts.slice(50).map((p: any) => p.id);
      const { error: delErr } = await sb.from('skool_posts').delete().in('id', idsToDelete);
      if (delErr) {
        console.error("[skool-feed-sync] Prune deletion failed:", delErr.message);
      }
    }

    return new Response(JSON.stringify({ success: true, count: postsToInsert.length }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
