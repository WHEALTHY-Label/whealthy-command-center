// WHEALTHY — rhythm-assess v2: email-identity (matches the app's member model; members have no JWT).
// Identity = ?email= query param, validated against approved_members. Same posture as bible/prayer fns.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id,member_status,archetype,archetype_name,load_season,load_score,kids_count,relationship,job_type,hours_band,age_band").ilike("email",email);
  const m=(rows||[])[0];
  if(!m) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email,member:m};
}
function chronoOf(score:number|null){ if(score==null) return null; if(score>=18) return "morning"; if(score<=11) return "evening"; return "intermediate"; }
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    const b=await req.json().catch(()=>({}));
    let score:number|null = (typeof b.rmeq_score==="number")?b.rmeq_score:null;
    if(score==null && Array.isArray(b.rmeq_items)) score=b.rmeq_items.reduce((a:number,x:unknown)=>a+(Number(x)||0),0);
    const chronotype=chronoOf(score);
    const m=g.member as Record<string,unknown>;
    const snap={archetype:m.archetype,archetype_name:m.archetype_name,load_season:m.load_season,load_score:m.load_score,kids_count:m.kids_count,relationship:m.relationship,job_type:m.job_type,hours_band:m.hours_band,age_band:m.age_band};
    await SB.from("rhythm_assessments").update({is_current:false}).eq("member_email",g.email).eq("is_current",true);
    const row={member_email:g.email,member_id:m.id,chronotype,rmeq_score:score,wake_time:b.wake_time||null,sleep_time:b.sleep_time||null,work_shape:b.work_shape||{},non_negotiables:b.non_negotiables||[],family_anchors:b.family_anchors||[],accountability_pref:b.accountability_pref||null,fasting_pref:b.fasting_pref||{},archetype_snapshot:snap,is_current:true};
    const {data,error}=await SB.from("rhythm_assessments").insert(row).select("id,chronotype,rmeq_score").single();
    if(error) return json({error:"insert_failed",detail:error.message},500);
    return json({ok:true,assessment_id:data.id,chronotype:data.chronotype,rmeq_score:data.rmeq_score,archetype:snap.archetype||null});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
