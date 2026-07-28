// WHEALTHY — rhythm-status v8.
// v8 adds `season` (item 6: active Fast takes precedence, else standalone rhythm season) + `fresh_start` moment (item 5).
// v7 draft branch (slots+invite+suggestions). v6 per-slot why/origin.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, GET, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
const toMin=(hhmm:string)=>{ const [h,m]=(hhmm||"").split(":").map(Number); return (h||0)*60+(m||0); };
const toHHMM=(mins:number)=>{ mins=((mins%1440)+1440)%1440; const h=Math.floor(mins/60),m=mins%60; return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"); };
function windowOf(mins:number){ const h=Math.floor(mins/60); if(h<11) return "morning"; if(h<14) return "midday"; if(h<18) return "afternoon"; return "evening"; }
const INVITE="Start with these two. Add another when this rhythm holds — a habit sticks better one anchor at a time.";
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id,archetype").ilike("email",email);
  if(!(rows||[])[0]) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email,member:(rows||[])[0]};
}
const dayStr=(off:number)=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
const daysBetween=(startISO:string,endISO:string)=>{ const s=new Date(startISO+"T00:00:00Z").getTime(); const t=new Date(endISO+"T00:00:00Z").getTime(); return Math.floor((t-s)/86400000); };
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SLOT_SEL="id,domain,title,product_key,cue_type,cue_value,if_then_text,day_mask,time_window,duration_min,sort_order,why,origin";
async function computeSuggestions(email:string, existing:any[]){
  const [aRows,ptRows,tries]=await Promise.all([
    SB.from("rhythm_assessments").select("*").eq("member_email",email).eq("is_current",true).limit(1),
    SB.from("product_timing").select("*").eq("active",true),
    SB.from("try_orders").select("product_key").eq("email",email),
  ]);
  const A=(aRows.data||[])[0]; if(!A) return [];
  const wake=A.wake_time?toMin(A.wake_time):390; const sleep=A.sleep_time?toMin(A.sleep_time):1350;
  const caffeineCutoff=sleep-8*60; const chrono=A.chronotype||"intermediate";
  const owned=new Set((tries.data||[]).map((t:{product_key:string})=>t.product_key).filter(Boolean));
  const PT:Record<string,any>=Object.fromEntries((ptRows.data||[]).map((p:any)=>[p.product_key,p]));
  const owns=(k:string)=>owned.has(k);
  const haveProduct=new Set(existing.map(s=>s.product_key).filter(Boolean));
  const haveDomain=new Set(existing.map(s=>s.domain));
  const cands:any[]=[];
  const caff=["genius_guice","charge","genius_joe"]; const energyKey=caff.find(owns)||"genius_joe"; const ep=PT[energyKey];
  if(ep && !haveProduct.has(energyKey)){ let t=wake+30; let why="Set to your "+chrono+" start, about 30 minutes after you wake."; if(ep.has_caffeine && t>caffeineCutoff){ t=caffeineCutoff-60; why="Caffeine, so it lands before your "+toHHMM(caffeineCutoff)+" cutoff to protect sleep."; } cands.push({domain:"supplement",title:ep.display_name+(owns(energyKey)?"":" (recommended)"),product_key:energyKey,cue_type:"time",cue_value:toHHMM(t),if_then_text:"When I wake at "+toHHMM(wake)+", I take "+ep.display_name+".",time_window:windowOf(t),day_mask:127,duration_min:10,why}); }
  if(PT["hydration"] && !haveProduct.has("hydration")){ cands.push({domain:"supplement",title:PT["hydration"].display_name+(owns("hydration")?"":" (recommended)"),product_key:"hydration",cue_type:"time",cue_value:"14:00",time_window:"afternoon",if_then_text:"When I hit the afternoon, I take "+PT["hydration"].display_name+".",day_mask:127,duration_min:10,why:"No caffeine, so it floats to the afternoon dip when energy sags."}); }
  if(PT["boss"] && !haveProduct.has("boss")){ cands.push({domain:"supplement",title:PT["boss"].display_name+(owns("boss")?"":" (recommended)"),product_key:"boss",cue_type:"time",cue_value:"17:30",time_window:"evening",if_then_text:"When I sit down before dinner, I take "+PT["boss"].display_name+".",day_mask:127,duration_min:10,why:"Anchored 20 to 30 minutes before a meal, per its label."}); }
  const fam=(A.family_anchors||[])[0];
  if(fam && !haveDomain.has("family")){ cands.push({domain:"family",title:fam.type==="date_night"?"Date night":fam.type==="kids"?"Time with the kids":"Family time",cue_type:"time",cue_value:(fam.when||"").match(/\d{1,2}:\d{2}/)?.[0]||"19:00",time_window:"evening",if_then_text:"When "+(fam.when||"the week's anchor comes")+", I protect family time.",day_mask:127,duration_min:10,why:"Protected on your week's anchor so it does not get crowded out."}); }
  return cands.map((c,i)=>({...c,suggest_order:i}));
}
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    const hasQuiz=!!(g.member.archetype && g.member.archetype!=="");
    const { data:plan }=await SB.from("rhythm_plans").select("id,name,ics_token,activated_at,season_days,season_start,season_ended_at").eq("member_email",g.email).eq("status","active").limit(1).maybeSingle();
    const { data:draft }=await SB.from("rhythm_plans").select("id").eq("member_email",g.email).eq("status","draft").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!plan){
      if(draft){
        const { data:dslots }=await SB.from("rhythm_slots").select(SLOT_SEL).eq("plan_id",draft.id).eq("active",true).order("sort_order");
        const DS=dslots||[];
        const suggestions=await computeSuggestions(g.email, DS);
        return json({ok:true,has_quiz:hasQuiz,has_plan:false,active_plan:false,is_draft:true,pending_draft:draft.id,pending_draft_id:draft.id,plan_id:draft.id,invite:INVITE,slots:DS.map(s=>({...s,today_status:null})),suggestions});
      }
      return json({ok:true,has_quiz:hasQuiz,has_plan:false,active_plan:false,pending_draft:null,pending_draft_id:null});
    }
    const { data:slots }=await SB.from("rhythm_slots").select(SLOT_SEL).eq("plan_id",plan.id).eq("active",true).order("sort_order");
    const S=slots||[];
    const today=dayStr(0), since7=dayStr(-6), since30=dayStr(-29), todayStart=today+"T00:00:00Z";
    let { data:checks }=await SB.from("rhythm_checkins").select("slot_id,check_date,status").eq("plan_id",plan.id).gte("check_date",since30);
    const C=checks||[];
    const todayMap:Record<string,string>={}; C.filter(c=>c.check_date===today).forEach(c=>{ todayMap[c.slot_id]=c.status; });
    const needPrayer=S.some(s=>s.domain==="prayer" && !todayMap[s.id]);
    const needScripture=S.some(s=>s.domain==="scripture" && !todayMap[s.id]);
    let prayerToday=false, scriptureToday=false;
    if(needPrayer){ const { count }=await SB.from("prayers").select("id",{count:"exact",head:true}).eq("member_id",g.member.id).gte("created_at",todayStart); prayerToday=(count||0)>0; }
    if(needScripture){
      const [refl,wd,bp]=await Promise.all([
        SB.from("bible_reflections").select("id",{count:"exact",head:true}).eq("member_email",g.email).gte("created_at",todayStart),
        SB.from("word_deliveries").select("id",{count:"exact",head:true}).eq("member_id",g.member.id).eq("delivered_on",today),
        SB.from("bible_progress").select("completed_days").eq("email",g.email),
      ]);
      const bpHit=(bp.data||[]).some((r:{completed_days:unknown})=>Array.isArray(r.completed_days)&&(r.completed_days as unknown[]).map(String).includes(today));
      scriptureToday=((refl.count||0)>0)||((wd.count||0)>0)||bpHit;
    }
    const derived:any[]=[];
    for(const s of S){
      if(todayMap[s.id]) continue;
      if(s.domain==="prayer" && prayerToday) derived.push({slot_id:s.id,plan_id:plan.id,member_email:g.email,check_date:today,status:"done",source:"prayer_checkin"});
      if(s.domain==="scripture" && scriptureToday) derived.push({slot_id:s.id,plan_id:plan.id,member_email:g.email,check_date:today,status:"done",source:"auto"});
    }
    if(derived.length){ await SB.from("rhythm_checkins").upsert(derived,{onConflict:"slot_id,check_date"}); derived.forEach(d=>{ todayMap[d.slot_id]="done"; C.push({slot_id:d.slot_id,check_date:today,status:"done"}); }); }
    const adh=(w:string)=>{ const s=C.filter(c=>c.check_date>=w); const done=s.filter(c=>c.status==="done").length; const acct=s.filter(c=>c.status!=="grace").length; return acct?Math.round(done/acct*100):null; };
    const consistency=new Set(C.filter(c=>c.status==="done").map(c=>c.check_date)).size;
    const hist:any[]=[];
    for(let i=6;i>=0;i--){ const ds=dayStr(-i); const dc=C.filter(c=>c.check_date===ds); const state=dc.some(c=>c.status==="done")?"done":dc.some(c=>c.status==="grace")?"grace":(ds===today?"today":(S.length?"missed":"none")); const dd=new Date(ds+"T00:00:00Z"); hist.push({date:ds,label:DOW[dd.getUTCDay()],state}); }
    const { data:tries }=await SB.from("try_orders").select("product_key").eq("email",g.email);
    const owned=new Set((tries||[]).map((t:{product_key:string})=>t.product_key).filter(Boolean));
    const unclaimed=S.filter(s=>s.domain==="supplement" && s.product_key && !owned.has(s.product_key)).map(s=>({slot_id:s.id,product_key:s.product_key,title:s.title}));
    const windows:Record<string,any[]>={morning:[],midday:[],afternoon:[],evening:[]};
    S.forEach(s=>{ (windows[s.time_window]||windows["evening"]).push({...s,today_status:todayMap[s.id]||null}); });
    const doneToday=S.filter(s=>todayMap[s.id]==="done").length;
    const d7=adh(since7), d30=adh(since30);
    // ---- season (item 6): active Fast wins, else standalone rhythm season, else offer to commit ----
    let season:any={source:null,can_commit:true,options:[21,40,90]};
    const { data:fast }=await SB.from("fasts").select("id,start_date,duration,cohort_id").eq("member_email",g.email).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(fast && fast.start_date && fast.duration){
      const elapsed=daysBetween(fast.start_date,today); const day=Math.max(1,Math.min(fast.duration,elapsed+1));
      season={source:"fast",day,total:fast.duration,days_left:Math.max(0,fast.duration-day),start_date:fast.start_date,completed:(elapsed+1)>fast.duration,cohort_id:fast.cohort_id||null,label:"Running with your Fast"};
    } else if(plan.season_days && plan.season_start && !plan.season_ended_at){
      const elapsed=daysBetween(plan.season_start,today); const day=Math.max(1,Math.min(plan.season_days,elapsed+1));
      season={source:"rhythm",day,total:plan.season_days,days_left:Math.max(0,plan.season_days-day),start_date:plan.season_start,completed:(elapsed+1)>plan.season_days,cohort_id:null,label:"Your "+plan.season_days+"-day rhythm"};
    }
    // ---- fresh_start moment (item 5): Sun/Mon reset with last-week summary ----
    let fresh_start:any={show:false};
    const dow=new Date().getUTCDay();
    if(dow===0||dow===1){
      const last7=C.filter(c=>c.check_date>=since7); const done7=last7.filter(c=>c.status==="done").length; const acct7=last7.filter(c=>c.status!=="grace").length;
      fresh_start={show:true,last_week_adherence:acct7?Math.round(done7/acct7*100):null,last_week_done:done7,line:"A new week, a clean page. Carry it well."};
    }
    return json({ok:true,has_quiz:hasQuiz,
      has_plan:true, active_plan:true, plan_id:plan.id, plan_name:plan.name, ics_token:plan.ics_token, pending_draft_id:null,
      slots:S.map(s=>({...s,today_status:todayMap[s.id]||null})),
      windows,
      today:{date:today,done:doneToday,total:S.length,all_done:S.length>0 && doneToday===S.length},
      adherence:{d7,d30}, adherence_pct:(d7!=null?d7:(d30!=null?d30:0)), adherence_history:hist,
      consistency_days:consistency,
      season, fresh_start,
      unclaimed_products:unclaimed});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
