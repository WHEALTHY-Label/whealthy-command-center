// WHEALTHY — rhythm-nudge-check v2: email-identity. Adaptive nudges, slipping only <75%.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, GET, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function requireMember(req:Request){
  let email=""; try{ email=(new URL(req.url).searchParams.get("email")||"").toLowerCase().trim(); }catch(_e){}
  if(!email||!email.includes("@")) return {ok:false as const,res:json({error:"no_email"},401)};
  const {data:rows}=await SB.from("approved_members").select("id").ilike("email",email);
  if(!(rows||[])[0]) return {ok:false as const,res:json({error:"not_a_member"},403)};
  return {ok:true as const,email};
}
const dayStr=(off:number)=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireMember(req); if(!g.ok) return g.res;
    const { data:plan }=await SB.from("rhythm_plans").select("id").eq("member_email",g.email).eq("status","active").limit(1).maybeSingle();
    if(!plan) return json({ok:true,nudges:[]});
    const { data:slots }=await SB.from("rhythm_slots").select("id,title,domain,product_key,time_window").eq("plan_id",plan.id).eq("active",true);
    const since14=dayStr(-13);
    const { data:checks }=await SB.from("rhythm_checkins").select("slot_id,status,check_date").eq("plan_id",plan.id).gte("check_date",since14);
    const C=checks||[];
    const cutoff=new Date(Date.now()-18*3600*1000).toISOString();
    const { data:recent }=await SB.from("rhythm_nudges").select("kind,slot_id,shown_at").eq("member_email",g.email).gte("shown_at",cutoff);
    const shown=new Set((recent||[]).map(r=>r.kind+":"+(r.slot_id||"")));
    const nudges:any[]=[];
    for(const s of (slots||[])){
      const rec=C.filter(c=>c.slot_id===s.id && c.status!=="grace");
      const done=C.filter(c=>c.slot_id===s.id && c.status==="done").length;
      if(rec.length>=4 && done/rec.length<0.75 && !shown.has("slipping:"+s.id))
        nudges.push({kind:"slipping",slot_id:s.id,title:s.title,copy:"Your "+s.title.toLowerCase()+" slipped a little this week. Pick it back up when you can."});
    }
    const dow=new Date().getUTCDay();
    if((dow===0||dow===1) && !shown.has("fresh_start:")) nudges.push({kind:"fresh_start",copy:"A new week. A clean page to carry well. Set your rhythm for the days ahead."});
    const { data:tries }=await SB.from("try_orders").select("product_key").eq("email",g.email);
    const owned=new Set((tries||[]).map((t:{product_key:string})=>t.product_key).filter(Boolean));
    const gap=(slots||[]).find(s=>s.domain==="supplement" && s.product_key && !owned.has(s.product_key) && !shown.has("product_slot:"+s.id));
    if(gap) nudges.push({kind:"product_slot",slot_id:gap.id,product_key:gap.product_key,copy:"Your "+gap.time_window+" governance slot is set. "+gap.title.replace(" (recommended)","")+" covers it when you are ready."});
    if(nudges.length){ await SB.from("rhythm_nudges").insert(nudges.map(n=>({member_email:g.email,slot_id:n.slot_id||null,kind:n.kind,channel:"in_app"}))); }
    return json({ok:true,nudges});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
