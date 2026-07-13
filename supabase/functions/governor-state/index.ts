import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { action, email, ...payload } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();

    // Verify member exists in approved_members
    const { data: member } = await SB.from("approved_members")
      .select("email").eq("email", cleanEmail).maybeSingle();
    if (!member) return json({ error: "not_authorized" }, 403);

    if (action === "load") {
      // 1. Load entries
      const { data: entries } = await SB.from("record_entries")
        .select("*")
        .eq("member_email", cleanEmail)
        .order("entry_date", { ascending: false });

      // 2. Load active fast (excluding discarded ones)
      const { data: fast } = await SB.from("fasts")
        .select("*")
        .eq("member_email", cleanEmail)
        .neq("status", "discarded")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Load history
      const { data: history } = await SB.from("fast_history")
        .select("*")
        .eq("member_email", cleanEmail)
        .order("created_at", { ascending: false });

      // 4. Load prefs
      let { data: prefs } = await SB.from("member_ai_prefs")
        .select("*")
        .eq("member_email", cleanEmail)
        .maybeSingle();
      if (!prefs) {
        prefs = { scribe_style: "full", landed: 0, missed: 0, last_scribe_lines: [] };
      }

      // 5. Load subscription state
      let product_state = "unequipped";
      let bundle_key = null;
      let bundle_name = null;
      let next_eligible_date = null;
      const { data: sub } = await SB.from("bundle_subscriptions")
        .select("bundle_key, bundle_name, status, next_eligible_date")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (sub) {
        bundle_key = sub.bundle_key;
        bundle_name = sub.bundle_name;
        next_eligible_date = sub.next_eligible_date;
        product_state = sub.status?.toLowerCase() === "active" ? "equipped" : "lapsed";
      } else {
        const { data: ord } = await SB.from("bundle_orders")
          .select("bundle_key")
          .eq("email", cleanEmail)
          .limit(1)
          .maybeSingle();
        if (ord) {
          bundle_key = ord.bundle_key;
          product_state = "lapsed";
        }
      }

      // Check if fast has active fast days checklist
      let fast_days = [];
      if (fast && fast.id) {
        const { data: fd } = await SB.from("fast_days")
          .select("*")
          .eq("fast_id", fast.id);
        if (fd) fast_days = fd;
      }

      // 6. Load member profile
      let { data: profile } = await SB.from("member_profile")
        .select("*")
        .eq("member_email", cleanEmail)
        .maybeSingle();
      if (!profile) {
        profile = {
          member_email: cleanEmail,
          season: "Building",
          identity_profile: "The Provider",
          archetype: "caffeine-dependent",
          recurring_people: [],
          recurring_burdens: [],
          recurring_wins: [],
          scripture_comfort: 1,
          scripture_engaged: 0,
          themes_that_land: [],
          tone_pref: "standard",
          responds_to: [],
          goes_quiet_on: [],
          last_summary: "",
          interaction_count: 0
        };
      }

      const { data: memberRec } = await SB.from("approved_members")
        .select("archetype, archetype_name, bundle_key, bundle_name")
        .eq("email", cleanEmail)
        .maybeSingle();
      const recommendation = memberRec ? {
        archetype: memberRec.archetype || null,
        archetype_name: memberRec.archetype_name || null,
        bundle_key: memberRec.bundle_key || null,
        bundle_name: memberRec.bundle_name || null,
      } : null;

      // Check if user is an affiliate and get their ref_id
      const { data: aff } = await SB.from("affiliates")
        .select("ref_id")
        .eq("email", cleanEmail)
        .maybeSingle();
      const affiliate_ref_id = aff ? aff.ref_id : null;

      // Count referrals for this affiliate code
      let referral_count = 0;
      if (affiliate_ref_id) {
        const { count } = await SB.from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("referral_code", affiliate_ref_id);
        referral_count = count || 0;
      }

      return json({
        ok: true,
        entries: entries || [],
        fast: fast || null,
        fast_days: fast_days,
        history: history || [],
        prefs: prefs,
        product_state,
        bundle_key,
        bundle_name,
        next_eligible_date,
        profile,
        recommendation,
        affiliate_ref_id,
        referral_count
      });
    }

    if (action === "save_entry") {
      const { entry_date, text, tone, fast_id, fast_day, scribe_line, resurface, tz_offset_min } = payload;
      
      // Enforce the 8:45 PM time gate on fast days
      if (fast_day !== undefined && fast_day !== null && tz_offset_min !== undefined) {
        const localMinutes = (Date.now() / 60000 - tz_offset_min) % 1440;
        const local = ((localMinutes % 1440) + 1440) % 1440;
        if (local < 20 * 60 + 45) {
          return json({ ok: false, error: "report_not_open" }, 200);
        }
      }

      const { data, error } = await SB.from("record_entries").upsert({
        member_email: cleanEmail,
        entry_date,
        text,
        tone,
        fast_id,
        fast_day,
        scribe_line,
        resurface,
        burned: false,
        created_at: new Date().toISOString()
      }, { onConflict: "member_email, entry_date" }).select();
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true, data });
    }

    if (action === "burn_entry") {
      const { entry_date } = payload;
      const { error } = await SB.from("record_entries").upsert({
        member_email: cleanEmail,
        entry_date,
        text: null,
        tone: null,
        scribe_line: null,
        resurface: null,
        burned: true,
        created_at: new Date().toISOString()
      }, { onConflict: "member_email, entry_date" });
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true });
    }

    if (action === "save_fast") {
      const { fast } = payload;
      if (!fast) return json({ error: "missing_fast" }, 400);
      const { error } = await SB.from("fasts").upsert({
        id: fast.id || undefined,
        member_email: cleanEmail,
        status: fast.status,
        fast_model: fast.fast_model,
        whys: fast.whys,
        laid: fast.laid,
        exclusions: fast.exclusions,
        duration: fast.duration,
        start_date: fast.start_date,
        anchors: fast.anchors,
        carried: fast.carried,
        product_state: fast.product_state,
        bundle_key: fast.bundle_key,
        structure_only: fast.structure_only,
        plan: fast.plan,
        briefs: fast.briefs || {},
        synthesis: fast.synthesis,
        ack_timestamp: fast.ack_timestamp || new Date().toISOString(),
        ended_day: fast.ended_day,
        created_at: fast.created_at || new Date().toISOString(),
        ended_at: fast.ended_at
      }, { onConflict: "id" });
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true });
    }

    if (action === "discard_fast") {
      const { error } = await SB.from("fasts")
        .update({ status: "discarded" })
        .eq("member_email", cleanEmail)
        .neq("status", "discarded");
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true });
    }

    if (action === "save_kept") {
      const { fast_id, day_number, day_date, rules_kept, tz_offset_min } = payload;

      // Enforce the 8:45 PM local time gate
      if (tz_offset_min !== undefined) {
        const localMinutes = (Date.now() / 60000 - tz_offset_min) % 1440;
        const local = ((localMinutes % 1440) + 1440) % 1440;
        if (local < 20 * 60 + 45) {
          return json({ ok: false, error: "report_not_open" }, 200);
        }
      }

      const { error } = await SB.from("fast_days").upsert({
        fast_id,
        member_email: cleanEmail,
        day_number,
        day_date,
        rules_kept,
        filed_at: new Date().toISOString()
      }, { onConflict: "fast_id, day_date" });
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true });
    }

    if (action === "end_fast") {
      const { fast_id, status, ended_day, history_row } = payload;
      
      // Update fast status
      const { error: fastError } = await SB.from("fasts")
        .update({ status, ended_day, ended_at: new Date().toISOString() })
        .eq("id", fast_id);
      if (fastError) return json({ ok: false, error: fastError.message }, 200);

      // Insert history row
      if (history_row) {
        const { error: histError } = await SB.from("fast_history").insert({
          member_email: cleanEmail,
          model: history_row.model,
          duration: history_row.duration,
          ended_day: history_row.ended_day,
          finished: history_row.finished,
          weak_rule: history_row.weak_rule,
          created_at: new Date().toISOString()
        });
        if (histError) return json({ ok: false, error: histError.message }, 200);
      }
      return json({ ok: true });
    }

    if (action === "save_profile") {
      const { delta } = payload;
      if (!delta) return json({ error: "missing_delta" }, 400);

      // Load current profile
      let { data: profile } = await SB.from("member_profile")
        .select("*")
        .eq("member_email", cleanEmail)
        .maybeSingle();

      if (!profile) {
        profile = {
          member_email: cleanEmail,
          season: "Building",
          identity_profile: "The Provider",
          archetype: "caffeine-dependent",
          recurring_people: [],
          recurring_burdens: [],
          recurring_wins: [],
          scripture_comfort: 1,
          scripture_engaged: 0,
          themes_that_land: [],
          tone_pref: "standard",
          responds_to: [],
          goes_quiet_on: [],
          last_summary: "",
          interaction_count: 0
        };
      }

      // Perform shallow merge and array union with weight increments for lists
      const mergeArrays = (curArr: any[], newArr: any[]) => {
        const map = new Map();
        (curArr || []).forEach(x => {
          if (x && x.name) map.set(x.name.toLowerCase(), x);
          else if (typeof x === 'string') map.set(x.toLowerCase(), { name: x, weight: 1 });
        });
        (newArr || []).forEach(x => {
          const name = (typeof x === 'string') ? x : (x && x.name);
          if (!name) return;
          const key = name.toLowerCase();
          if (map.has(key)) {
            const existing = map.get(key);
            existing.weight = (existing.weight || 1) + 1;
            if (x.mentions) existing.mentions = (existing.mentions || 0) + 1;
          } else {
            map.set(key, (typeof x === 'string') ? { name: x, weight: 1 } : { ...x, weight: 1 });
          }
        });
        return Array.from(map.values());
      };

      const updated = {
        ...profile,
        season: delta.season !== undefined ? delta.season : profile.season,
        identity_profile: delta.identity_profile !== undefined ? delta.identity_profile : profile.identity_profile,
        archetype: delta.archetype !== undefined ? delta.archetype : profile.archetype,
        scripture_comfort: delta.scripture_comfort !== undefined ? delta.scripture_comfort : profile.scripture_comfort,
        scripture_engaged: delta.scripture_engaged !== undefined ? delta.scripture_engaged : profile.scripture_engaged,
        tone_pref: delta.tone_pref !== undefined ? delta.tone_pref : profile.tone_pref,
        last_summary: delta.last_summary !== undefined ? delta.last_summary : profile.last_summary,
        interaction_count: (profile.interaction_count || 0) + 1,
        recurring_people: mergeArrays(profile.recurring_people, delta.recurring_people),
        recurring_burdens: mergeArrays(profile.recurring_burdens, delta.recurring_burdens),
        recurring_wins: mergeArrays(profile.recurring_wins, delta.recurring_wins),
        themes_that_land: mergeArrays(profile.themes_that_land, delta.themes_that_land),
        responds_to: mergeArrays(profile.responds_to, delta.responds_to),
        goes_quiet_on: mergeArrays(profile.goes_quiet_on, delta.goes_quiet_on),
        updated_at: new Date().toISOString()
      };

      const { error } = await SB.from("member_profile").upsert(updated);
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true, profile: updated });
    }

    if (action === "save_prefs") {
      const { scribe_style, landed, missed, last_scribe_lines } = payload;
      const { error } = await SB.from("member_ai_prefs").upsert({
        member_email: cleanEmail,
        scribe_style,
        landed,
        missed,
        last_scribe_lines,
        updated_at: new Date().toISOString()
      }, { onConflict: "member_email" });
      if (error) return json({ ok: false, error: error.message }, 200);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "content-type": "application/json" },
  });
}
