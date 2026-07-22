// WHEALTHY — rhythm-checkin v2: email-identity. Upsert adherence (done|skipped|grace).
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id").ilike("email",email);
  if(!(rows||[])[0]) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email};
}
const VALID=new Set(["done","skipped","grace"]);
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    const b=await req.json().catch(()=>({}));
    if(!b.slot_id || !VALID.has(b.status)) return json({error:"bad_request",message:"slot_id and status(done|skipped|grace) required"},400);
    const { data:slot }=await SB.from("rhythm_slots").select("id,plan_id,member_email").eq("id",b.slot_id).limit(1).maybeSingle();
    if(!slot || slot.member_email!==g.email) return json({error:"not_found"},404);
    const date=(b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date))?b.date:new Date().toISOString().slice(0,10);
    const { error }=await SB.from("rhythm_checkins").upsert({slot_id:b.slot_id,plan_id:slot.plan_id,member_email:g.email,check_date:date,status:b.status,source:b.source||"manual"},{onConflict:"slot_id,check_date"});
    if(error) return json({error:"checkin_failed",detail:error.message},500);
    return json({ok:true,slot_id:b.slot_id,check_date:date,status:b.status});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
