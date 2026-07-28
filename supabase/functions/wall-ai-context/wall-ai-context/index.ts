import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, scope } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SB = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify member exists and get member_id
    const { data: member, error: memberErr } = await SB
      .from('approved_members')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberId = member.id;

    if (scope === 'own') {
      // 1. Fetch own posts
      const { data: ownPosts, error: ownPostsErr } = await SB
        .from('wall_posts')
        .select('id, body, status, display_mode, pray_count, created_at, answered_at, answered_note')
        .eq('member_id', memberId);

      if (ownPostsErr) throw ownPostsErr;

      const posts = (ownPosts || []).map(p => {
        const created = new Date(p.created_at);
        const answered = p.answered_at ? new Date(p.answered_at) : new Date();
        const days_elapsed = Math.floor((answered.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
        return {
          id: p.id,
          body: p.body,
          status: p.status,
          display_mode: p.display_mode,
          pray_count: p.pray_count,
          created_at: p.created_at,
          answered_at: p.answered_at,
          answered_note: p.answered_note,
          days_elapsed
        };
      });

      // 2. Fetch watchlist (all posts viewer prayed for, no body text retrieved)
      const { data: praysData, error: praysErr } = await SB
        .from('wall_prays')
        .select('post_id, created_at, seen_answered_at')
        .eq('member_id', memberId);

      if (praysErr) throw praysErr;

      const watchlistMap = new Map();
      (praysData || []).forEach(row => {
        if (!watchlistMap.has(row.post_id)) {
          watchlistMap.set(row.post_id, {
            post_id: row.post_id,
            my_pray_count: 0,
            last_prayed_at: new Date(0),
            seen_answered_at: null
          });
        }
        const val = watchlistMap.get(row.post_id);
        val.my_pray_count += 1;
        const rowCreated = new Date(row.created_at);
        if (rowCreated > val.last_prayed_at) {
          val.last_prayed_at = rowCreated;
        }
        if (row.seen_answered_at) {
          const rowSeen = new Date(row.seen_answered_at);
          if (!val.seen_answered_at || rowSeen > new Date(val.seen_answered_at)) {
            val.seen_answered_at = row.seen_answered_at;
          }
        }
      });

      const postIds = Array.from(watchlistMap.keys());
      let watchlist: any[] = [];

      if (postIds.length > 0) {
        const { data: watchlistPosts, error: watchlistPostsErr } = await SB
          .from('wall_posts')
          .select('id, status, created_at, answered_at, pray_count')
          .in('id', postIds);

        if (watchlistPostsErr) throw watchlistPostsErr;

        watchlist = (watchlistPosts || []).map(p => {
          const val = watchlistMap.get(p.id);
          const days_since_prayed = Math.floor((Date.now() - val.last_prayed_at.getTime()) / (24 * 60 * 60 * 1000));
          const has_unseen_answer = p.status === 'answered' && (
            !val.seen_answered_at || new Date(p.answered_at) > new Date(val.seen_answered_at)
          );

          const created = new Date(p.created_at);
          const answered = p.answered_at ? new Date(p.answered_at) : new Date();
          const days_elapsed = Math.max(0, Math.floor((answered.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)));

          return {
            id: p.id,
            status: p.status,
            days_since_prayed,
            has_unseen_answer,
            my_pray_count: val.my_pray_count,
            days_elapsed,
            pray_count: p.pray_count
          };
        });
      }

      return new Response(JSON.stringify({
        scope: 'own',
        posts,
        watchlist
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (scope === 'community') {
      // This function must never return prayer text on scope='community'.
      // The anonymity mask is display-only: wall_posts stores real member_ids.
      // A model that can read across anonymous prayers can correlate them.
      // Counts only. If a feature needs text here, the feature is wrong.

      // 1. live_post_count
      const { count: live_post_count, error: err1 } = await SB
        .from('wall_posts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'live');

      if (err1) throw err1;

      // 2. prays_last_24h
      const { count: prays_last_24h, error: err2 } = await SB
        .from('wall_prays')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (err2) throw err2;

      // 3. answered_last_7d
      const { count: answered_last_7d, error: err3 } = await SB
        .from('wall_posts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'answered')
        .gt('answered_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (err3) throw err3;

      // 4. top_post_pray_count
      const { data: topPostData, error: err4 } = await SB
        .from('wall_posts')
        .select('pray_count')
        .eq('status', 'live')
        .order('pray_count', { ascending: false })
        .limit(1);

      if (err4) throw err4;

      const top_post_pray_count = topPostData?.[0]?.pray_count || 0;

      return new Response(JSON.stringify({
        scope: 'community',
        live_post_count: live_post_count || 0,
        prays_last_24h: prays_last_24h || 0,
        answered_last_7d: answered_last_7d || 0,
        top_post_pray_count
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid scope' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err: any) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
