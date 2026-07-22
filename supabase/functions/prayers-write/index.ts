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
    const { email, action, ...payload } = await req.json();
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

    if (action === "create") {
      const { body, category } = payload;
      const cleanBody = (body || "").trim();
      if (cleanBody.length < 1 || cleanBody.length > 1000) {
        return json({ error: "Prayer body must contain between 1 and 1000 characters." }, 400);
      }
      // Legacy closet categories + Hand It Over v2 chip vocabulary (Ignacio, Jul 20). Old kept for existing rows.
      const allowedCategories = ["household", "soul", "provision", "brothers", "unaware", "family", "work", "money", "health", "head", "freeform"];
      if (!allowedCategories.includes(category)) {
        return json({ error: "Steward must select a valid category for their prayer." }, 400);
      }

      const { data, error } = await SB.from("prayers")
        .insert({
          member_id: memberId,
          body: cleanBody,
          category,
          state: "not_yet",
          asked_on: new Date().toISOString().split("T")[0],
          pinned: false
        })
        .select()
        .single();

      if (error) {
        console.error("Create prayer error:", error);
        return json({ error: "Unable to store their prayer in the closet." }, 500);
      }
      return json(data);

    } else if (action === "update") {
      const { id, body } = payload;
      const cleanBody = (body || "").trim();
      if (!id) return json({ error: "Prayer ID is required." }, 400);
      if ("category" in payload || "asked_on" in payload || "asked_date" in payload) {
        return json({ error: "Category and asked_on date are immutable." }, 400);
      }
      if (cleanBody.length < 1 || cleanBody.length > 1000) {
        return json({ error: "Prayer body must contain between 1 and 1000 characters." }, 400);
      }

      const { data: existing, error: findErr } = await SB.from("prayers")
        .select("state")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (findErr || !existing) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }
      if (existing.state !== "not_yet") {
        return json({ error: "Closed entries cannot be updated." }, 400);
      }

      const { data, error } = await SB.from("prayers")
        .update({ body: cleanBody })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Update error:", error);
        return json({ error: "Unable to update their prayer closet entry." }, 500);
      }
      return json(data);

    } else if (action === "close") {
      const { id, state, outcome } = payload;
      const cleanOutcome = (outcome || "").trim();
      if (!id) return json({ error: "Prayer ID is required." }, 400);
      if (!["yes", "no"].includes(state)) {
        return json({ error: "Closure requires a response of yes or no." }, 400);
      }
      if (cleanOutcome.length < 1 || cleanOutcome.length > 1000) {
        return json({ error: "Closure outcome must contain between 1 and 1000 characters." }, 400);
      }

      const { data: existing, error: findErr } = await SB.from("prayers")
        .select("wall_post_id")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (findErr || !existing) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }

      const { data: updatedPrayer, error: closeErr } = await SB.from("prayers")
        .update({
          state,
          outcome: cleanOutcome,
          closed_on: new Date().toISOString().split("T")[0]
        })
        .eq("id", id)
        .select()
        .single();

      if (closeErr) {
        console.error("Close error:", closeErr);
        return json({ error: "Unable to close their prayer entry." }, 500);
      }

      if (state === "yes" && existing.wall_post_id) {
        const { error: wallErr } = await SB.from("wall_posts")
          .update({
            answered_note: cleanOutcome,
            status: "answered",
            answered_at: new Date().toISOString(),
            answered_note_locked_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("id", existing.wall_post_id);

        if (wallErr) {
          console.error("Propagation to wall posts was prevented:", wallErr);
        }
      }

      return json(updatedPrayer);

    } else if (action === "reopen") {
      const { id } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);

      const { data: existing, error: findErr } = await SB.from("prayers")
        .select("id")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (findErr || !existing) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }

      const { data, error } = await SB.from("prayers")
        .update({
          state: "not_yet",
          closed_on: null,
          outcome: null
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Reopen error:", error);
        return json({ error: "Unable to reopen their prayer entry." }, 500);
      }
      return json(data);

    } else if (action === "pin") {
      const { id } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);

      const { data, error } = await SB.from("prayers")
        .update({ pinned: true })
        .eq("id", id)
        .eq("member_id", memberId)
        .select()
        .single();

      if (error) {
        console.error("Pin error:", error);
        return json({ error: "Unable to pin their prayer." }, 500);
      }
      return json(data);

    } else if (action === "unpin") {
      const { id } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);

      const { data, error } = await SB.from("prayers")
        .update({ pinned: false })
        .eq("id", id)
        .eq("member_id", memberId)
        .select()
        .single();

      if (error) {
        console.error("Unpin error:", error);
        return json({ error: "Unable to unpin their prayer." }, 500);
      }
      return json(data);

    } else if (action === "publish") {
      const { id, display_mode } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);
      if (!["signed", "anonymous"].includes(display_mode)) {
        return json({ error: "Publishing requires a valid display mode." }, 400);
      }

      const { data: prayer, error: findErr } = await SB.from("prayers")
        .select("*")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (findErr || !prayer) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }
      if (prayer.category === "unaware") {
        return json({ error: "Prayers for unaware individuals cannot be published." }, 400);
      }
      if (prayer.wall_post_id) {
        return json({ error: "This prayer has already been published to the assembly." }, 400);
      }

      const { data: wallPost, error: wallErr } = await SB.from("wall_posts")
        .insert({
          member_id: memberId,
          body: prayer.body,
          source: "wall",
          display_mode,
          status: "live",
          pray_count: 0
        })
        .select("id")
        .single();

      if (wallErr || !wallPost) {
        console.error("Publish insert error:", wallErr);
        return json({ error: "Unable to publish their prayer to the assembly." }, 500);
      }

      const { data: updatedPrayer, error: linkErr } = await SB.from("prayers")
        .update({ wall_post_id: wallPost.id })
        .eq("id", id)
        .select()
        .single();

      if (linkErr) {
        console.error("Link prayer to wall post error:", linkErr);
        return json({ error: "Unable to associate the published post with their prayer." }, 500);
      }

      return json(updatedPrayer);

    } else if (action === "lift") {
      // Hand It Over: lift a private prayer to the Prayer Wall. Idempotent: if the wall
      // post was already created + linked (by wall-post with prayer_id), just return success.
      const { id, display_mode } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);
      const { data: prayer, error: findErr } = await SB.from("prayers")
        .select("*")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();
      if (findErr || !prayer) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }
      if (prayer.wall_post_id) {
        return json(prayer); // already lifted, idempotent success
      }
      if (prayer.category === "unaware") {
        return json({ error: "Prayers for unaware individuals cannot be published." }, 400);
      }
      const mode = ["signed", "anonymous"].includes(display_mode) ? display_mode : "anonymous";
      const { data: wallPost, error: wallErr } = await SB.from("wall_posts")
        .insert({ member_id: memberId, body: prayer.body, source: "wall", display_mode: mode, status: "live", pray_count: 0 })
        .select("id")
        .single();
      if (wallErr || !wallPost) {
        console.error("Lift insert error:", wallErr);
        return json({ error: "Unable to lift their prayer to the wall." }, 500);
      }
      const { data: updatedPrayer, error: linkErr } = await SB.from("prayers")
        .update({ wall_post_id: wallPost.id })
        .eq("id", id)
        .select()
        .single();
      if (linkErr) {
        return json({ error: "Unable to associate the lifted prayer." }, 500);
      }
      return json(updatedPrayer);

    } else if (action === "answered") {
      // Hand It Over: mark a handed-over weight answered. Closes as 'yes' with the note as
      // outcome. If already on the wall, that post becomes an answered testimony. If not and
      // lift_to_testimony is set, create an answered wall post (surfaces in testimony_river).
      const { id, note, lift_to_testimony } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);
      const cleanNote = (note || "").trim();
      if (cleanNote.length < 1 || cleanNote.length > 1000) {
        return json({ error: "Answer note must contain between 1 and 1000 characters." }, 400);
      }
      const { data: prayer, error: findErr } = await SB.from("prayers")
        .select("*")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();
      if (findErr || !prayer) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }
      const { data: updatedPrayer, error: closeErr } = await SB.from("prayers")
        .update({ state: "yes", outcome: cleanNote, closed_on: new Date().toISOString().split("T")[0] })
        .eq("id", id)
        .select()
        .single();
      if (closeErr) {
        console.error("Answered close error:", closeErr);
        return json({ error: "Unable to mark the prayer answered." }, 500);
      }
      const nowIso = new Date().toISOString();
      const lockIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (prayer.wall_post_id) {
        await SB.from("wall_posts")
          .update({ answered_note: cleanNote, status: "answered", answered_at: nowIso, answered_note_locked_at: lockIso })
          .eq("id", prayer.wall_post_id);
      } else if (lift_to_testimony && prayer.category !== "unaware") {
        const { data: wp } = await SB.from("wall_posts")
          .insert({ member_id: memberId, body: prayer.body, source: "wall", display_mode: "signed", status: "answered", answered_note: cleanNote, answered_at: nowIso, answered_note_locked_at: lockIso, pray_count: 0 })
          .select("id")
          .single();
        if (wp) await SB.from("prayers").update({ wall_post_id: wp.id }).eq("id", id);
      }
      return json(updatedPrayer);

    } else if (action === "unpublish") {
      const { id } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);

      const { data: prayer, error: findErr } = await SB.from("prayers")
        .select("*")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (findErr || !prayer) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }
      if (!prayer.wall_post_id) {
        return json({ error: "This prayer is not published." }, 400);
      }

      const { error: wallErr } = await SB.from("wall_posts")
        .update({ status: "archived" })
        .eq("id", prayer.wall_post_id)
        .eq("member_id", memberId);

      if (wallErr) {
        console.error("Unpublish archive error:", wallErr);
        return json({ error: "Unable to archive the published wall post." }, 500);
      }

      const { data: updatedPrayer, error: unlinkErr } = await SB.from("prayers")
        .update({ wall_post_id: null })
        .eq("id", id)
        .select()
        .single();

      if (unlinkErr) {
        console.error("Unpublish unlink error:", unlinkErr);
        return json({ error: "Unable to unpublish their prayer." }, 500);
      }

      return json(updatedPrayer);

    } else if (action === "milestone_shown") {
      const { id, milestone } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);
      const milestoneNum = Number(milestone);
      if (isNaN(milestoneNum)) {
        return json({ error: "Valid milestone number is required." }, 400);
      }

      const { data, error } = await SB.from("prayers")
        .update({ last_milestone_asked: milestoneNum })
        .eq("id", id)
        .eq("member_id", memberId)
        .select()
        .single();

      if (error) {
        console.error("Milestone shown update error:", error);
        return json({ error: "Unable to update their milestone tracking state." }, 500);
      }
      return json(data);

    } else if (action === "delete") {
      const { id } = payload;
      if (!id) return json({ error: "Prayer ID is required." }, 400);

      const { data: prayer, error: findErr } = await SB.from("prayers")
        .select("*")
        .eq("id", id)
        .eq("member_id", memberId)
        .maybeSingle();

      if (findErr || !prayer) {
        return json({ error: "Prayer entry not found in their closet." }, 404);
      }

      if (prayer.state !== "not_yet") {
        return json({ error: "A closed prayer entry can never be deleted." }, 400);
      }
      if (prayer.wall_post_id) {
        return json({ error: "A published prayer entry can never be deleted." }, 400);
      }

      const { error: deleteErr } = await SB.from("prayers")
        .delete()
        .eq("id", id);

      if (deleteErr) {
        console.error("Delete error:", deleteErr);
        return json({ error: "Unable to delete their prayer entry." }, 500);
      }

      return json({ success: true });
    } else {
      return json({ error: "Unknown action requested." }, 400);
    }
  } catch (err: any) {
    console.error("Error in prayers-write:", err);
    return json({ error: err.message || "Server error encountered." }, 500);
  }
});
