// WHEALTHY — rhythm-build v4: email-identity. Deterministic engine.
// START-SMALL (item 2): persists 1-2 CORE anchors into the draft; returns the rest as suggestions[] (unpersisted, one-tap add).
// WHY (item 3): every candidate carries a short honest reason, surfaced in the timeline.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id").ilike("email",email);
  const m=(rows||[])[0];
  if(!m) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email,memberId:m.id as number};
}
const toMin=(hhmm:string)=>{ const [h,m]=(hhmm||"").split(":").map(Number); return (h||0)*60+(m||0); };
const toHHMM=(mins:number)=>{ mins=((mins%1440)+1440)%1440; const h=Math.floor(mins/60),m=mins%60; return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"); };
function windowOf(mins:number){ const h=Math.floor(mins/60); if(h<11) return "morning"; if(h<14) return "midday"; if(h<18) return "afternoon"; return "evening"; }
const CORE_COUNT = 2; // research: start with 1-2 anchors, grow as they hold
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    const { data:aRows }=await SB.from("rhythm_assessments").select("*").eq("member_email",g.email).eq("is_current",true).limit(1);
    const A=(aRows||[])[0];
    if(!A) return json({error:"no_assessment",message:"Complete the Rhythm Assessment first."},409);
    const wake=A.wake_time?toMin(A.wake_time):390;
    const sleep=A.sleep_time?toMin(A.sleep_time):1350;
    const caffeineCutoff=sleep-8*60;
    const chrono=A.chronotype||"intermediate";
    const [tries,ptRows,fasts]=await Promise.all([
      SB.from("try_orders").select("product_key").eq("email",g.email),
      SB.from("product_timing").select("*").eq("active",true),
      SB.from("fasts").select("status").eq("member_email",g.email).eq("status","active"),
    ]);
    const owned=new Set((tries.data||[]).map((t:{product_key:string})=>t.product_key).filter(Boolean));
    const PT:Record<string,any>=Object.fromEntries((ptRows.data||[]).map((p:any)=>[p.product_key,p]));
    const owns=(k:string)=>owned.has(k);
    // candidate = full slot shape + priority (lower = more core) + why
    const cands:any[]=[];
    const push=(c:any)=>{ cands.push({domain:c.domain,title:c.title,product_key:c.product_key||null,cue_type:c.cue_type||"time",cue_value:c.cue_value||null,if_then_text:c.if_then,day_mask:c.day_mask??127,time_window:c.time_window||windowOf(toMin(c.cue_value||"08:00")),duration_min:c.duration_min||10,why:c.why||null,priority:c.priority}); };
    // 1) Scripture (spiritual spine, no purchase pressure) — most core
    const wordNn=(A.non_negotiables||[]).find((n:any)=>n.domain==="scripture");
    push({domain:"scripture",title:"Open the Word",cue_type:"stack",cue_value:wordNn?.when||"after the morning cup",time_window:"morning",if_then:"When "+(wordNn?.when||"I finish my morning cup")+", I open the Word.",why:"Stacked on a routine you already keep, so it sticks without a new alarm.",priority:1});
    // 2) Prayer — second core
    const prayerNn=(A.non_negotiables||[]).find((n:any)=>n.domain==="prayer");
    const prayerCue=prayerNn?.when||"before bed";
    push({domain:"prayer",title:"Prayer check-in",cue_type:"stack",cue_value:prayerCue,time_window:"evening",if_then:"When "+prayerCue+", I check in with prayer.",why:"Closes the day, and it flows straight from your prayer wall.",priority:2});
    // 3) Energy supplement (chronotype- and caffeine-aware)
    const caff=["genius_guice","charge","genius_joe"]; const ownedCaff=caff.find(owns); const energyKey=ownedCaff||"genius_joe";
    const ep=PT[energyKey];
    if(ep){ let t=wake+30; let why="Set to your "+chrono+" start, about 30 minutes after you wake.";
      if(ep.has_caffeine && t>caffeineCutoff){ t=caffeineCutoff-60; why="Caffeine, so it lands before your "+toHHMM(caffeineCutoff)+" cutoff to protect sleep."; }
      const rec=owns(energyKey)?"":" (recommended)";
      push({domain:"supplement",title:ep.display_name+rec,product_key:energyKey,cue_type:"time",cue_value:toHHMM(t),if_then:"When I wake at "+toHHMM(wake)+", I take "+ep.display_name+".",why,priority:3});
    }
    // 4) Hydration (no caffeine, floats to afternoon dip)
    if(PT["hydration"]){ const rec=owns("hydration")?"":" (recommended)"; push({domain:"supplement",title:PT["hydration"].display_name+rec,product_key:"hydration",cue_type:"time",cue_value:"14:00",time_window:"afternoon",if_then:"When I hit the afternoon, I take "+PT["hydration"].display_name+".",why:"No caffeine, so it floats to the afternoon dip when energy sags.",priority:4}); }
    // 5) Boss (before dinner)
    if(PT["boss"]){ const rec=owns("boss")?"":" (recommended)"; push({domain:"supplement",title:PT["boss"].display_name+rec,product_key:"boss",cue_type:"time",cue_value:"17:30",time_window:"evening",if_then:"When I sit down before dinner, I take "+PT["boss"].display_name+".",why:"Anchored 20 to 30 minutes before a meal, per its label.",priority:5}); }
    // 6) Family anchor
    const fam=(A.family_anchors||[])[0];
    if(fam){ push({domain:"family",title:fam.type==="date_night"?"Date night":fam.type==="kids"?"Time with the kids":"Family time",cue_type:"time",cue_value:(fam.when||"").match(/\d{1,2}:\d{2}/)?.[0]||"19:00",time_window:"evening",if_then:"When "+(fam.when||"the week's anchor comes")+", I protect family time.",why:"Protected on your week's anchor so it does not get crowded out.",priority:6}); }
    cands.sort((a,b)=>a.priority-b.priority);
    const core=cands.slice(0,CORE_COUNT);
    const suggestions=cands.slice(CORE_COUNT).map((c,i)=>({domain:c.domain,title:c.title,product_key:c.product_key,cue_type:c.cue_type,cue_value:c.cue_value,if_then_text:c.if_then_text,day_mask:c.day_mask,time_window:c.time_window,duration_min:c.duration_min,why:c.why,suggest_order:i}));
    // persist plan + CORE slots only
    const { data:plan, error:pErr }=await SB.from("rhythm_plans").insert({member_email:g.email,member_id:g.memberId,status:"draft",source_assessment_id:A.id}).select("id,ics_token").single();
    if(pErr) return json({error:"plan_insert_failed",detail:pErr.message},500);
    const rows=core.map((s,i)=>({domain:s.domain,title:s.title,product_key:s.product_key,cue_type:s.cue_type,cue_value:s.cue_value,if_then_text:s.if_then_text,day_mask:s.day_mask,time_window:s.time_window,duration_min:s.duration_min,why:s.why,origin:"engine",sort_order:i,plan_id:plan.id,member_email:g.email}));
    const { data:ins, error:sErr }=await SB.from("rhythm_slots").insert(rows).select("id,domain,title,product_key,cue_type,cue_value,if_then_text,time_window,sort_order,why,origin");
    if(sErr) return json({error:"slots_insert_failed",detail:sErr.message},500);
    return json({ok:true,plan_id:plan.id,status:"draft",start_small:true,
      invite:"Start with these two. Add another when this rhythm holds — a habit sticks better one anchor at a time.",
      chronotype:chrono,caffeine_cutoff:toHHMM(caffeineCutoff),fasting_active:(fasts.data||[]).length>0,
      slots:(ins||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order),
      suggestions});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
