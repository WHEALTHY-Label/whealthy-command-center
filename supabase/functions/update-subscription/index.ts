import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json({ error: "email required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // verify membership
    const { data: member } = await supabase
      .from("approved_members")
      .select("email,active,active_through")
      .ilike("email", email)
      .maybeSingle();
    if (!member) return json({ error: "not_a_member" }, 403);
    const expired = member.active_through &&
      new Date(member.active_through) < new Date();
    if (member.active === false || expired) {
      return json({ error: "membership_inactive" }, 403);
    }

    // build a partial update from only the provided fields
    const s = body.shipping || {};
    const patch: Record<string, unknown> = {};
    if (body.bundle_key)  patch.bundle_key  = String(body.bundle_key);
    if (body.bundle_name) patch.bundle_name = body.bundle_name;
    if (typeof body.auto_order === "boolean") patch.auto_order = body.auto_order;
    if (body.status) patch.status = body.status;
    if (s.name)      patch.ship_name     = s.name;
    if (s.phone)     patch.ship_phone    = s.phone;
    if (s.address1)  patch.ship_address1 = s.address1;
    if ("address2" in s) patch.ship_address2 = s.address2;
    if (s.city)      patch.ship_city     = s.city;
    if (s.state)     patch.ship_state    = s.state;
    if (s.zip)       patch.ship_zip      = s.zip;
    if (s.country)   patch.ship_country  = s.country;

    if (Object.keys(patch).length === 0) {
      return json({ error: "nothing_to_update" }, 400);
    }

    const { error } = await supabase
      .from("bundle_subscriptions")
      .update(patch)
      .ilike("email", email);
    if (error) return json({ error: "update_failed", detail: error.message }, 500);

    return json({ success: true });
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
