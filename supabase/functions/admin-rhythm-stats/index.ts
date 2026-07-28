// WHEALTHY — admin-rhythm-stats: rhythm analytics for the Control Panel. Admin-gated (master|admin).
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, GET, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function requireAdmin(req:Request){
  const h=req.headers.get("Authorization")||req.headers.get("authorization")||"";
  const t=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(!t) return {ok:false as const,res:json({error:"not_authorized",reason:"no_token"},401)};
  const {data,error}=await SB.auth.getUser(t);
  const email=data?.user?.email?.toLowerCase()||"";
  if(error||!email) return {ok:false as const,res:json({error:"not_authorized",reason:"invalid_token"},401)};
  const {data:rows,error:rErr}=await SB.from("approved_members").select("admin_role").ilike("email",email);
  if(rErr) return {ok:false as const,res:json({error:"server_error"},500)};
  const isAdmin=(rows||[]).some((r:{admin_role:string|null})=>r.admin_role==="master"||r.admin_role==="admin");
  if(!isAdmin) return {ok:false as const,res:json({error:"forbidden",reason:"not_admin"},403)};
  return {ok:true as const};
}
const tally=(rows:any[],key:(r:any)=>string|null):[string,number][]=>{ const m=new Map<string,number>(); for(const r of rows){ const k=key(r); if(!k) continue; m.set(k,(m.get(k)??0)+1);} return [...m.entries()].sort((a,b)=>b[1]-a[1]); };
const median=(a:number[])=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2); };
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const gate=await requireAdmin(req); if(!gate.ok) return gate.res;
    const since30=(()=>{ const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10); })();
    const [plans,assess,checks]=await Promise.all([
      SB.from("rhythm_plans").select("id,member_email,status"),
      SB.from("rhythm_assessments").select("chronotype").eq("is_current",true),
      SB.from("rhythm_checkins").select("member_email,status,check_date").gte("check_date",since30),
    ]);
    const P=plans.data||[]; const activePlans=P.filter(p=>p.status==="active");
    const activeIds=new Set(activePlans.map(p=>p.id));
    const { data:slots }=await SB.from("rhythm_slots").select("plan_id,domain,product_key").eq("active",true);
    const activeSlots=(slots||[]).filter(s=>activeIds.has(s.plan_id));
    // per-member 30d adherence over active members
    const byMember=new Map<string,{done:number,acct:number}>();
    for(const c of (checks.data||[])){ const m=byMember.get(c.member_email)||{done:0,acct:0}; if(c.status==="done")m.done++; if(c.status!=="grace")m.acct++; byMember.set(c.member_email,m); }
    const rates=[...byMember.values()].filter(v=>v.acct>0).map(v=>Math.round(v.done/v.acct*100));
    const avg=rates.length?Math.round(rates.reduce((a,b)=>a+b,0)/rates.length):null;
    const chrono=tally(assess.data||[],(r:any)=>r.chronotype);
    return json({
      live:true,
      plans:{ active:activePlans.length, draft:P.filter(p=>p.status==="draft").length, members_with_plan:new Set(activePlans.map(p=>p.member_email)).size },
      assessments:{ current:(assess.data||[]).length, chronotype:chrono },
      adherence:{ avg30:avg, median30:median(rates), members_measured:rates.length },
      slots:{ total_active:activeSlots.length, by_domain:tally(activeSlots,(s:any)=>s.domain) },
      products:{ scheduled:tally(activeSlots.filter(s=>s.domain==="supplement"),(s:any)=>s.product_key) },
    });
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
