// WHEALTHY — rhythm-activate v3: email-identity. Draft -> active on approval.
// v3 fires the rhythm-activated email (best-effort, gated by the send-email kill-switch).
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function mail(to:string, template:string, data:unknown){
  try{ await fetch(`${SUPABASE_URL}/functions/v1/send-email`,{ method:"POST", headers:{ "Content-Type":"application/json", "apikey":SERVICE, "Authorization":"Bearer "+SERVICE }, body:JSON.stringify({to,template,data}) }); }catch(_e){}
}
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id,name").ilike("email",email);
  if(!(rows||[])[0]) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email,name:(rows||[])[0].name as string|undefined};
}
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    const b=await req.json().catch(()=>({}));
    if(!b.plan_id) return json({error:"missing_plan_id"},400);
    const { data:plan }=await SB.from("rhythm_plans").select("id,member_email,status,ics_token").eq("id",b.plan_id).limit(1).maybeSingle();
    if(!plan || plan.member_email!==g.email) return json({error:"not_found"},404);
    await SB.from("rhythm_plans").update({status:"archived"}).eq("member_email",g.email).eq("status","active");
    const { data:up, error }=await SB.from("rhythm_plans").update({status:"active",activated_at:new Date().toISOString()}).eq("id",b.plan_id).select("id,status,ics_token").single();
    if(error) return json({error:"activate_failed",detail:error.message},500);
    await mail(g.email,"rhythm-activated",{name:g.name||null});
    return json({ok:true,plan_id:up.id,status:up.status,ics_token:up.ics_token});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
