// WHEALTHY — onboarding-state v2: gate driver. join | pending | quiz | bundle | ready.
// v2 adds 'pending' — a non-member who has requested access and is awaiting admin approval (24h).
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, GET, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
const REVIEW_MSG="Your request is in. We review new stewards within 24 hours, and you'll get access once you're approved.";
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
    if(!email){ const b=await req.json().catch(()=>({})); email=(b.email||"").toLowerCase().trim(); }
    const { data:setRows }=await SB.from("site_settings").select("key,value").in("key",["skool_join_url","member_discount_pct","member_discount_code","app_exclusive_enabled"]);
    const S:Record<string,string>=Object.fromEntries((setRows||[]).map((r:{key:string;value:string})=>[r.key,r.value]));
    const cfg={ skool_url:S.skool_join_url||"https://www.skool.com/bakndcreator", discount_pct:parseInt(S.member_discount_pct||"10")||10, discount_code:S.member_discount_code||"", exclusive:(S.app_exclusive_enabled||"true")!=="false" };
    const notMember=(gate:string,extra:Record<string,unknown>={})=>json({ok:true,verified:false,gate,skool_url:cfg.skool_url,exclusive:cfg.exclusive,...extra});
    if(!email||!email.includes("@")) return notMember("join",{reason:"no_email"});
    const { data:rows }=await SB.from("approved_members").select("id,member_status,active,admin_role,archetype,archetype_name,bundle_key,bundle_name").ilike("email",email);
    const m=(rows||[])[0];
    if(!m || m.member_status==="banned" || m.active===false){
      // pending request awaiting admin approval?
      const { data:pend }=await SB.from("pending_registrations").select("id,created_at").ilike("email",email).eq("status","pending").limit(1);
      if((pend||[]).length) return notMember("pending",{pending:true,message:REVIEW_MSG});
      return notMember("join");
    }
    const quizDone=!!(m.archetype && m.archetype!=="");
    const [ord,sub]=await Promise.all([
      SB.from("bundle_orders").select("id",{count:"exact",head:true}).ilike("email",email),
      SB.from("bundle_subscriptions").select("status").ilike("email",email),
    ]);
    const hasOrder=(ord.count||0)>0;
    const hasSub=(sub.data||[]).some((s:{status:string})=>s.status==="active"||s.status==="paused");
    const bundleClaimed=hasOrder||hasSub;
    const { data:plan }=await SB.from("rhythm_plans").select("id").eq("member_email",email).eq("status","active").limit(1).maybeSingle();
    const gate = !quizDone ? "quiz" : (!bundleClaimed ? "bundle" : "ready");
    return json({
      ok:true, verified:true,
      member_status:m.member_status||"member", admin_role:m.admin_role||null,
      quiz_done:quizDone, archetype:m.archetype||null, archetype_name:m.archetype_name||null,
      bundle:{ key:m.bundle_key||null, name:m.bundle_name||null }, bundle_claimed:bundleClaimed,
      rhythm_active: !!plan, gate,
      skool_url:cfg.skool_url, exclusive:cfg.exclusive, discount_pct:cfg.discount_pct, discount_code:cfg.discount_code,
    });
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
