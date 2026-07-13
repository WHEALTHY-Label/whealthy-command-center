import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { user_ids } = await req.json();
    if (!user_ids || !Array.isArray(user_ids)) {
      return new Response(JSON.stringify({ error: "Invalid user_ids array" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const namesMap: Record<string, string> = {};

    // For each user_id, get their email from auth.users (requires service role)
    for (const id of user_ids) {
      const { data: userAuth, error: authErr } = await supabaseAdmin.auth.admin.getUserById(id);
      
      if (userAuth?.user?.email) {
        // Now look up their real name in approved_members
        const { data: memberData } = await supabaseAdmin
          .from("approved_members")
          .select("name")
          .ilike("email", userAuth.user.email)
          .maybeSingle();

        if (memberData?.name) {
          namesMap[id] = memberData.name;
        } else {
            // Fallback to metadata if they have it
            if(userAuth.user.user_metadata?.name || userAuth.user.user_metadata?.full_name) {
                namesMap[id] = userAuth.user.user_metadata?.name || userAuth.user.user_metadata?.full_name;
            }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, data: namesMap }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error fetching names:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
