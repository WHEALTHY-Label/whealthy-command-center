// WHEALTHY — member-orders v1: email-identity. Returns a member's Shopify order history + tracking
// for the Product Portal. Read-only. Members have no JWT; identity is the ?email= query param.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"GET, POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
    if(!email||!email.includes("@")) return json({error:"no_email"},401);
    const { data:rows }=await SB.from("approved_members").select("id").ilike("email",email);
    if(!(rows||[])[0]) return json({error:"not_a_member"},403);
    const { data:orders }=await SB.from("member_orders")
      .select("order_number,financial_status,fulfillment_status,line_items,total_price,currency,tracking_company,tracking_number,tracking_url,ordered_at,fulfilled_at")
      .eq("member_email",email).order("ordered_at",{ascending:false}).limit(100);
    return json({ok:true,count:(orders||[]).length,orders:orders||[]});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
