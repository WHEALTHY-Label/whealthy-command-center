// WHEALTHY — member-onboarding-check v1: processes due rows in member_onboarding_queue.
// day0 -> member-welcome. day2 -> take-assessment (if unnamed) | member-day2-nudge (if First Steps <3/7) | skip.
// day7 -> member-day7-recap. Sends via send-email. Does nothing while email_enabled=false (unless {test:true}).
// Called by pg_cron with x-webhook-secret. Mirrors the nurture processor pattern.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("NURTURE_WEBHOOK_SECRET");
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-webhook-secret", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function mail(to:string, template:string, data:unknown){
  try{ const r=await fetch(`${SUPABASE_URL}/functions/v1/send-email`,{ method:"POST", headers:{ "Content-Type":"application/json", "apikey":SERVICE, "Authorization":"Bearer "+SERVICE }, body:JSON.stringify({to,template,data}) }); return r.ok; }catch(_e){ return false; }
}
async function settings(){ const { data }=await SB.from("site_settings").select("key,value"); const m:Record<string,string>={}; (data||[]).forEach((r:any)=>{ m[r.key]=r.value; }); return m; }
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  if(!SECRET) return json({error:"nurture_webhook_secret_not_configured"},503);
  const secret=req.headers.get("x-webhook-secret")||""; const auth=req.headers.get("authorization")||"";
  if(secret!==SECRET && auth!=="Bearer "+SERVICE) return json({error:"not_authorized"},401);
  const b=await req.json().catch(()=>({}));
  const st=await settings();
  const enabled=(st.email_enabled||"false").toLowerCase()==="true";
  if(!enabled && !b.test) return json({ok:true,skipped:"email_disabled"});
  const nowIso=new Date().toISOString();
  const { data:due }=await SB.from("member_onboarding_queue").select("id,member_email,kind").is("sent_at",null).eq("cancelled",false).lte("scheduled_at",nowIso).order("scheduled_at").limit(200);
  let sent=0,skipped=0,cancelled=0;
  for(const row of (due||[])){
    const email=row.member_email;
    const { data:mem }=await SB.from("approved_members").select("name,first_steps,archetype,active,member_status").ilike("email",email).maybeSingle();
    if(!mem || mem.active===false || mem.member_status==="banned"){ await SB.from("member_onboarding_queue").update({cancelled:true,skip_reason:"not_active"}).eq("id",row.id); cancelled++; continue; }
    const name=mem.name||null; let template:string|null=null; let skipReason:string|null=null;
    if(row.kind==="day0") template="member-welcome";
    else if(row.kind==="day7") template="member-day7-recap";
    else if(row.kind==="day2"){
      const { count:aCount }=await SB.from("rhythm_assessments").select("id",{count:"exact",head:true}).eq("member_email",email).eq("is_current",true);
      const hasAssessment=(aCount||0)>0 || (mem.archetype && mem.archetype!=="");
      if(!hasAssessment) template="take-assessment";
      else { const fs:any=mem.first_steps||{}; const done=Object.values(fs).filter(v=>v===true).length; if(done<3) template="member-day2-nudge"; else { template=null; skipReason="first_steps_"+done+"_of_7"; } }
    }
    if(template){ const ok=await mail(email,template,{name}); if(ok){ await SB.from("member_onboarding_queue").update({sent_at:new Date().toISOString()}).eq("id",row.id); sent++; } }
    else { await SB.from("member_onboarding_queue").update({sent_at:new Date().toISOString(),skipped:true,skip_reason:skipReason}).eq("id",row.id); skipped++; }
  }
  return json({ok:true,processed:(due||[]).length,sent,skipped,cancelled});
});
