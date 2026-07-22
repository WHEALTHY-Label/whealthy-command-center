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
    const { email, view, cursor = 0, limit = 10, id } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail) {
      return json({ error: "Steward email is required to fetch their record." }, 400);
    }

    const { data: member, error: memberErr } = await SB.from("approved_members")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (memberErr || !member) {
      return json({ error: "Steward is not authorized. Check their status." }, 401);
    }

    const memberId = member.id;

    // Default (no view): Hand It Over ledger. Every weight, newest first, with a computed
    // status: 'private' (not on the wall), 'lifted' (on the wall, with live pray count),
    // or 'answered' (closed). Returns a plain array.
    if (!view) {
      const { data: rows, error } = await SB.from("prayers")
        .select("id, body, category, created_at, state, wall_post_id, outcome, closed_on")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Handover ledger read error:", error);
        return json({ error: "Unable to fetch their handovers." }, 500);
      }
      const wallIds = (rows || []).map((r: any) => r.wall_post_id).filter(Boolean);
      const prayMap: Record<string, number> = {};
      if (wallIds.length) {
        const { data: wp } = await SB.from("wall_posts").select("id, pray_count").in("id", wallIds);
        (wp || []).forEach((w: any) => { prayMap[w.id] = w.pray_count || 0; });
      }
      const handovers = (rows || []).map((r: any) => {
        let status = "private";
        if (r.state === "yes" || r.state === "no") status = "answered";
        else if (r.wall_post_id) status = "lifted";
        return {
          id: r.id,
          body: r.body,
          category: r.category,
          created_at: r.created_at,
          status,
          pray_count: r.wall_post_id ? (prayMap[r.wall_post_id] || 0) : 0,
          outcome: r.outcome,
          closed_on: r.closed_on,
        };
      });
      return json(handovers);
    }

    if (view === "mirror") {
      const { data: prayers, error } = await SB.from("prayers")
        .select("*")
        .eq("member_id", memberId)
        .eq("state", "not_yet")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Mirror read error:", error);
        return json({ error: "Unable to fetch their prayer closet." }, 500);
      }

      const categories = ["household", "soul", "provision", "brothers", "unaware"];
      const grouped: Record<string, any[]> = {};
      categories.forEach(c => { grouped[c] = []; });

      (prayers || []).forEach(p => {
        if (grouped[p.category]) {
          grouped[p.category].push(p);
        }
      });

      return json(grouped);

    } else if (view === "daily") {
      const pageSize = Number(limit) || 5;
      const { data: dailyPrayers, error } = await SB.from("prayers")
        .select("*")
        .eq("member_id", memberId)
        .eq("state", "not_yet")
        .order("pinned", { ascending: false })
        .order("last_surfaced_at", { ascending: true, nullsFirst: true })
        .limit(pageSize);

      if (error) {
        console.error("Daily read error:", error);
        return json({ error: "Unable to fetch their daily surfaced set." }, 500);
      }

      if (dailyPrayers && dailyPrayers.length > 0) {
        const ids = dailyPrayers.map(p => p.id);
        const { error: updateErr } = await SB.from("prayers")
          .update({ last_surfaced_at: new Date().toISOString() })
          .in("id", ids);
        
        if (updateErr) {
          console.error("Warning: last_surfaced_at timestamp update did not succeed:", updateErr);
        }
      }

      return json(dailyPrayers);

    } else if (view === "answered") {
      const pageSize = Number(limit) || 20;
      const offset = Number(cursor) || 0;

      const { data: closedPrayers, error } = await SB.from("prayers")
        .select("id, body, asked_on, closed_on, outcome, state, category, wall_post_id")
        .eq("member_id", memberId)
        .in("state", ["yes", "no"])
        .order("closed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("Answered read error:", error);
        return json({ error: "Unable to fetch their answered testimonies." }, 500);
      }

      const { count: yesCount, error: countErr } = await SB.from("prayers")
        .select("*", { count: "exact", head: true })
        .eq("member_id", memberId)
        .eq("state", "yes");

      if (countErr) {
        console.error("Yes count error:", countErr);
      }

      return json({
        prayers: closedPrayers,
        yesCount: yesCount || 0
      });

    } else if (view === "milestone") {
      const { data: prayers, error } = await SB.from("prayers")
        .select("*")
        .eq("member_id", memberId)
        .eq("state", "not_yet")
        .order("asked_on", { ascending: true });

      if (error) {
        console.error("Milestone read error:", error);
        return json({ error: "Unable to fetch their milestone candidates." }, 500);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let selectedPrayer = null;
      let selectedMilestone = 0;

      for (const p of (prayers || [])) {
        const askedDate = new Date(p.asked_on);
        askedDate.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - askedDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let currentMilestone = 0;
        if (diffDays >= 365) {
          currentMilestone = 365 * Math.floor(diffDays / 365);
        } else if (diffDays >= 90) {
          currentMilestone = 90;
        } else if (diffDays >= 30) {
          currentMilestone = 30;
        }

        if (currentMilestone > 0 && currentMilestone > (p.last_milestone_asked || 0)) {
          selectedPrayer = p;
          selectedMilestone = currentMilestone;
          break;
        }
      }

      if (selectedPrayer) {
        return json({
          prayer: selectedPrayer,
          milestone: selectedMilestone
        });
      } else {
        return json(null);
      }

    } else if (view === "one") {
      if (!id) return json({ error: "Prayer ID is required." }, 400);

      const { data: prayer, error } = await SB.from("prayers")
        .select("*")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (error || !prayer) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }
      return json(prayer);

    } else {
      return json({ error: "Unknown view requested." }, 400);
    }
  } catch (err: any) {
    console.error("Error in prayers-read:", err);
    return json({ error: err.message || "Server error encountered." }, 500);
  }
});
