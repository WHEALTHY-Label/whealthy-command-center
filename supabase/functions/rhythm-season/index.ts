// WHEALTHY — rhythm-season v1 (item 6): commit / end a standalone rhythm season (21|40|90 days).
// Email-identity, ownership-checked on the member's active plan. A fast, if active, takes precedence in rhythm-status.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
const ALLOWED=[21,40,90];
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id").ilike("email",email);
  if(!(rows||[])[0]) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email};
}
const todayStr=()=>{ return new Date().toISOString().slice(0,10); };
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    let body:any={}; try{ body=await req.json(); }catch(_e){ return json({error:"bad_json"},400); }
    const action=String(body.action||"").toLowerCase();
    const { data:plan }=await SB.from("rhythm_plans").select("id,member_email,season_days,season_start,season_ended_at").eq("member_email",g.email).eq("status","active").limit(1).maybeSingle();
    if(!plan) return json({error:"no_active_plan",message:"Activate your rhythm before committing a season."},409);

    if(action==="commit"){
      const len=Number(body.length_days);
      if(!ALLOWED.includes(len)) return json({error:"bad_length",message:"Choose 21, 40, or 90 days."},400);
      const start=todayStr();
      const { error }=await SB.from("rhythm_plans").update({season_days:len,season_start:start,season_ended_at:null}).eq("id",plan.id);
      if(error) return json({error:"commit_failed",detail:error.message},500);
      return json({ok:true,season:{source:"rhythm",total:len,day:1,days_left:len-1,start_date:start,completed:false}});
    }
    if(action==="end"){
      const { error }=await SB.from("rhythm_plans").update({season_ended_at:new Date().toISOString()}).eq("id",plan.id);
      if(error) return json({error:"end_failed",detail:error.message},500);
      return json({ok:true,season:null});
    }
    return json({error:"unknown_action",allowed:["commit","end"]},400);
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
