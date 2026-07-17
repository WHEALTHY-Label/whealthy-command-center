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
    const { email, action, movement } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail) {
      return json({ error: "Steward email is required to fetch their state." }, 400);
    }

    const { data: member, error: memberErr } = await SB.from("approved_members")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (memberErr || !member) {
      return json({ error: "Steward is not authorized. Check their status." }, 401);
    }

    const memberId = member.id;

    if (action === "get") {
      const { data: state, error } = await SB.from("member_prayer_state")
        .select("midday_next_movement, unaware_empty_seen")
        .eq("member_id", memberId)
        .maybeSingle();

      if (error) {
        console.error("Get state error:", error);
        return json({ error: "Unable to retrieve their midday prayer rotation state." }, 500);
      }

      if (!state) {
        // Upsert default state = 1, unaware_empty_seen = false
        const { data: upserted, error: upsertErr } = await SB.from("member_prayer_state")
          .insert({ member_id: memberId, midday_next_movement: 1, unaware_empty_seen: false })
          .select("midday_next_movement, unaware_empty_seen")
          .single();

        if (upsertErr || !upserted) {
          console.error("Upsert default state error:", upsertErr);
          return json({ error: "Unable to initialize their midday prayer rotation state." }, 500);
        }
        return json(upserted);
      }

      return json(state);

    } else if (action === "seen_unaware") {
      const { data: updated, error: updateErr } = await SB.from("member_prayer_state")
        .upsert({
          member_id: memberId,
          unaware_empty_seen: true,
          updated_at: new Date().toISOString()
        })
        .select("midday_next_movement, unaware_empty_seen")
        .single();

      if (updateErr || !updated) {
        console.error("Seen unaware state error:", updateErr);
        return json({ error: "Unable to update their unaware empty seen state." }, 500);
      }

      return json(updated);

    } else if (action === "advance") {
      const { data: state, error: getErr } = await SB.from("member_prayer_state")
        .select("midday_next_movement, unaware_empty_seen")
        .eq("member_id", memberId)
        .maybeSingle();

      if (getErr) {
        console.error("Get state for advance error:", getErr);
        return json({ error: "Unable to retrieve their midday prayer rotation state." }, 500);
      }

      const currentStep = state ? state.midday_next_movement : 1;
      const nextStep = (currentStep % 6) + 1;

      const { data: updated, error: updateErr } = await SB.from("member_prayer_state")
        .upsert({
          member_id: memberId,
          midday_next_movement: nextStep,
          updated_at: new Date().toISOString()
        })
        .select("midday_next_movement, unaware_empty_seen")
        .single();

      if (updateErr || !updated) {
        console.error("Advance state error:", updateErr);
        return json({ error: "Unable to update their midday prayer rotation state." }, 500);
      }

      return json(updated);

    } else if (action === "jump") {
      const step = Number(movement);
      if (isNaN(step) || step < 1 || step > 6) {
        return json({ error: "Manual jump requires a valid movement step between 1 and 6." }, 400);
      }

      const { data: updated, error: updateErr } = await SB.from("member_prayer_state")
        .upsert({
          member_id: memberId,
          midday_next_movement: step,
          unaware_empty_seen: false,
          updated_at: new Date().toISOString()
        })
        .select("midday_next_movement, unaware_empty_seen")
        .single();

      if (updateErr || !updated) {
        console.error("Jump state error:", updateErr);
        return json({ error: "Unable to update their midday prayer rotation state." }, 500);
      }

      return json(updated);

    } else {
      return json({ error: "Unknown action requested." }, 400);
    }
  } catch (err: any) {
    console.error("Error in prayer-state:", err);
    return json({ error: err.message || "Server error encountered." }, 500);
  }
});
