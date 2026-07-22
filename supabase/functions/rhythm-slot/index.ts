// WHEALTHY — rhythm-slot v1: steward-owned plan editing (add/update/delete/reorder).
// Email-identity (members have no JWT), ownership-checked by member_email. Item 1 of the rhythm build.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
const MAX_ACTIVE = 14; // soft cap: research says don't over-schedule; block runaway adds, not normal use
const DOMAINS = new Set(["supplement","scripture","prayer","family","movement","rest","work","custom"]);
const toMin=(hhmm:string)=>{ const [h,m]=(hhmm||"").split(":").map(Number); return (h||0)*60+(m||0); };
function windowOf(mins:number){ const h=Math.floor(mins/60); if(h<11) return "morning"; if(h<14) return "midday"; if(h<18) return "afternoon"; return "evening"; }
function clampMask(v:unknown){ const n=Number(v); if(!Number.isFinite(n)) return 127; return Math.max(0,Math.min(127,Math.trunc(n))); }
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id").ilike("email",email);
  const m=(rows||[])[0];
  if(!m) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email,memberId:m.id as number};
}
// Resolve the plan the edit targets: explicit plan_id (ownership-checked) else the member's active plan else newest draft.
async function resolvePlan(email:string, planId?:string){
  if(planId){
    const {data}=await SB.from("rhythm_plans").select("id,member_email,status").eq("id",planId).maybeSingle();
    if(!data || (data.member_email||"").toLowerCase()!==email) return null;
    return data;
  }
  const {data:active}=await SB.from("rhythm_plans").select("id,member_email,status").eq("member_email",email).eq("status","active").limit(1).maybeSingle();
  if(active) return active;
  const {data:draft}=await SB.from("rhythm_plans").select("id,member_email,status").eq("member_email",email).eq("status","draft").order("created_at",{ascending:false}).limit(1).maybeSingle();
  return draft||null;
}
async function ownedSlot(email:string, slotId:string){
  const {data}=await SB.from("rhythm_slots").select("id,member_email,plan_id,cue_type,cue_value,time_window").eq("id",slotId).maybeSingle();
  if(!data || (data.member_email||"").toLowerCase()!==email) return null;
  return data;
}
const SEL = "id,domain,title,product_key,cue_type,cue_value,if_then_text,day_mask,time_window,duration_min,sort_order,active,why,origin";
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    let body:any={}; try{ body=await req.json(); }catch(_e){ return json({error:"bad_json"},400); }
    const action=String(body.action||"").toLowerCase();

    if(action==="add"){
      const plan=await resolvePlan(g.email, body.plan_id);
      if(!plan) return json({error:"no_plan",message:"No rhythm plan to add to. Build your rhythm first."},409);
      const {count}=await SB.from("rhythm_slots").select("id",{count:"exact",head:true}).eq("plan_id",plan.id).eq("active",true);
      if((count||0)>=MAX_ACTIVE) return json({error:"too_many",message:"You already have a full rhythm. Remove one before adding another."},409);
      const title=String(body.title||"").trim(); if(!title) return json({error:"title_required"},400);
      const cue_type=body.cue_type==="stack"?"stack":"time";
      const cue_value=String(body.cue_value||"").trim();
      let time_window=String(body.time_window||"").trim();
      if(!time_window) time_window = cue_type==="time" && /^\d{1,2}:\d{2}$/.test(cue_value) ? windowOf(toMin(cue_value)) : "morning";
      const domain=DOMAINS.has(String(body.domain))?String(body.domain):"custom";
      const if_then_text = String(body.if_then_text||"").trim() || (cue_value?("When "+cue_value+", I "+title.toLowerCase()+"."):null);
      const {data:mx}=await SB.from("rhythm_slots").select("sort_order").eq("plan_id",plan.id).order("sort_order",{ascending:false}).limit(1).maybeSingle();
      const sort_order=(mx?.sort_order??-1)+1;
      const row={ plan_id:plan.id, member_email:g.email, domain, title, product_key:body.product_key||null,
        cue_type, cue_value:cue_value||null, if_then_text, day_mask:clampMask(body.day_mask), time_window,
        duration_min:Math.max(1,Math.min(240,Number(body.duration_min)||10)), sort_order, active:true,
        why:(body.why?String(body.why):null), origin:"steward" };
      const {data:ins,error}=await SB.from("rhythm_slots").insert(row).select(SEL).single();
      if(error) return json({error:"insert_failed",detail:error.message},500);
      return json({ok:true,slot:ins});
    }

    if(action==="update"){
      const slotId=String(body.slot_id||""); if(!slotId) return json({error:"slot_id_required"},400);
      const cur=await ownedSlot(g.email,slotId); if(!cur) return json({error:"not_found"},404);
      const patch:any={ origin:"steward", updated_at:new Date().toISOString() };
      if(body.title!=null){ const t=String(body.title).trim(); if(!t) return json({error:"title_required"},400); patch.title=t; }
      if(body.domain!=null) patch.domain=DOMAINS.has(String(body.domain))?String(body.domain):"custom";
      if(body.cue_type!=null) patch.cue_type=body.cue_type==="stack"?"stack":"time";
      if(body.cue_value!=null) patch.cue_value=String(body.cue_value).trim()||null;
      if(body.if_then_text!=null) patch.if_then_text=String(body.if_then_text).trim()||null;
      if(body.why!=null) patch.why=String(body.why).trim()||null;
      if(body.day_mask!=null) patch.day_mask=clampMask(body.day_mask);
      if(body.duration_min!=null) patch.duration_min=Math.max(1,Math.min(240,Number(body.duration_min)||10));
      if(body.product_key!==undefined) patch.product_key=body.product_key||null;
      // time_window: explicit wins, else recompute from a time cue when the cue changed
      const eff_ct = patch.cue_type||cur.cue_type; const eff_cv = patch.cue_value!==undefined?patch.cue_value:cur.cue_value;
      if(body.time_window!=null) patch.time_window=String(body.time_window).trim();
      else if(body.cue_value!=null && eff_ct==="time" && /^\d{1,2}:\d{2}$/.test(String(eff_cv||""))) patch.time_window=windowOf(toMin(String(eff_cv)));
      const {data:upd,error}=await SB.from("rhythm_slots").update(patch).eq("id",slotId).select(SEL).single();
      if(error) return json({error:"update_failed",detail:error.message},500);
      return json({ok:true,slot:upd});
    }

    if(action==="delete"){
      const slotId=String(body.slot_id||""); if(!slotId) return json({error:"slot_id_required"},400);
      const cur=await ownedSlot(g.email,slotId); if(!cur) return json({error:"not_found"},404);
      const {error}=await SB.from("rhythm_slots").update({active:false,updated_at:new Date().toISOString()}).eq("id",slotId);
      if(error) return json({error:"delete_failed",detail:error.message},500);
      return json({ok:true,slot_id:slotId,removed:true});
    }

    if(action==="reorder"){
      const order:string[]=Array.isArray(body.order)?body.order.map(String):[];
      if(!order.length) return json({error:"order_required"},400);
      const plan=await resolvePlan(g.email, body.plan_id);
      if(!plan) return json({error:"no_plan"},409);
      const {data:mine}=await SB.from("rhythm_slots").select("id").eq("plan_id",plan.id);
      const valid=new Set((mine||[]).map((r:{id:string})=>r.id));
      const filtered=order.filter(id=>valid.has(id));
      if(!filtered.length) return json({error:"no_matching_slots"},400);
      for(let i=0;i<filtered.length;i++){ await SB.from("rhythm_slots").update({sort_order:i,updated_at:new Date().toISOString()}).eq("id",filtered[i]); }
      const {data:after}=await SB.from("rhythm_slots").select(SEL).eq("plan_id",plan.id).eq("active",true).order("sort_order");
      return json({ok:true,slots:after||[]});
    }

    return json({error:"unknown_action",allowed:["add","update","delete","reorder"]},400);
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
