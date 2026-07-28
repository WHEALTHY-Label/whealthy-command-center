import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email } = await req.json();
    if (!email) return json({ error: "email required" }, 400);
    const e = String(email).trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Active member?
    const { data: member } = await supabase
      .from("approved_members")
      .select("id,email,name,last_name,archetype,archetype_name,bundle_key,bundle_name,identity_anchor,active,active_through,member_status,load_score,load_season,consumption,hours_band,job_type,kids_count,relationship,sex,age_band")
      .ilike("email", e)
      .maybeSingle();

    if (!member) return json({ verified: false });
    const expired = member.active_through && new Date(member.active_through) < new Date();
    if (member.active === false || expired) return json({ verified: false, lapsed: true });

    // 2. Existing subscription?
    const { data: sub } = await supabase
      .from("bundle_subscriptions")
      .select("*")
      .ilike("email", e)
      .maybeSingle();

    // 3. Order history (last 12)
    const { data: orders } = await supabase
      .from("bundle_orders")
      .select("id,bundle_key,bundle_name,status,source,created_at,confirmed_at,shipped_at,ship_city,ship_state")
      .ilike("email", e)
      .order("created_at", { ascending: false })
      .limit(12);

    return json({
      verified: true,
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        last_name: member.last_name || null,
        identity_anchor: member.identity_anchor || null,
        member_status: member.member_status || null,
        // Part 1 quiz fields for claim-page personalization
        load_score: member.load_score ?? null,
        load_season: member.load_season || null,
        consumption: member.consumption || null,
        hours_band: member.hours_band || null,
        job_type: member.job_type || null,
        kids_count: member.kids_count ?? null,
        relationship: member.relationship || null,
        sex: member.sex || null,
        age_band: member.age_band || null,
      },
      recommendation: {
        archetype: member.archetype || null,
        archetype_name: member.archetype_name || null,
        bundle_key: member.bundle_key || null,
        bundle_name: member.bundle_name || null,
      },
      subscription: sub || null,
      orders: orders || [],
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
