// WHEALTHY — admin-registrations v3: vet pending access requests. Admin-gated, audited.
// v3 sends the approval welcome (approve) or a soft decline (reject) via send-email.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
async function mail(to:string, template:string, data:unknown){
  try{ await fetch(`${SUPABASE_URL}/functions/v1/send-email`,{ method:"POST", headers:{ "Content-Type":"application/json", "apikey":SERVICE, "Authorization":"Bearer "+SERVICE }, body:JSON.stringify({to,template,data}) }); }catch(_e){}
}
async function requireAdmin(req:Request){
  const h=req.headers.get("Authorization")||req.headers.get("authorization")||"";
  const t=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(!t) return {ok:false as const,res:json({error:"not_authorized",reason:"no_token"},401)};
  const {data,error}=await SB.auth.getUser(t);
  const email=data?.user?.email?.toLowerCase()||"";
  if(error||!email) return {ok:false as const,res:json({error:"not_authorized",reason:"invalid_token"},401)};
  const {data:rows,error:rErr}=await SB.from("approved_members").select("admin_role").ilike("email",email);
  if(rErr) return {ok:false as const,res:json({error:"server_error"},500)};
  const role=(rows||[]).map((r:{admin_role:string|null})=>r.admin_role).find((x:string|null)=>x==="master"||x==="admin");
  if(!role) return {ok:false as const,res:json({error:"forbidden",reason:"not_admin"},403)};
  return {ok:true as const,email,role};
}
async function audit(actor:string,role:string,action:string,target:string,details:unknown){
  try{ await SB.from("admin_audit_log").insert({actor_email:actor,actor_role:role,action,target,details}); }catch(_e){}
}
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const g=await requireAdmin(req); if(!g.ok) return g.res;
    const b=await req.json().catch(()=>({}));
    const action=b.action||"list";
    if(action==="list"){
      const status=b.status||"pending";
      const { data }=await SB.from("pending_registrations").select("id,email,name,skool_handle,note,status,created_at,reviewed_by,reviewed_at").eq("status",status).order("created_at",{ascending:true}).limit(500);
      const { count:pendingCount }=await SB.from("pending_registrations").select("id",{count:"exact",head:true}).eq("status","pending");
      return json({ok:true,registrations:data||[],pending_count:pendingCount||0});
    }
    if(action==="approve"||action==="reject"){
      if(!b.id) return json({error:"missing_id"},400);
      const { data:reg }=await SB.from("pending_registrations").select("id,email,name,skool_handle,status").eq("id",b.id).limit(1).maybeSingle();
      if(!reg) return json({error:"not_found"},404);
      if(reg.status!=="pending") return json({error:"already_reviewed",status:reg.status},409);
      if(action==="approve"){
        const { error:mErr }=await SB.from("approved_members").upsert({email:reg.email,name:reg.name||reg.email.split("@")[0],skool_handle:reg.skool_handle||null,member_status:"member",active:true,joined_at:new Date().toISOString()},{onConflict:"email"});
        if(mErr) return json({error:"approve_failed",detail:mErr.message},500);
      }
      const { error:uErr }=await SB.from("pending_registrations").update({status:action==="approve"?"approved":"rejected",reviewed_by:g.email,reviewed_at:new Date().toISOString()}).eq("id",b.id);
      if(uErr) return json({error:"update_failed",detail:uErr.message},500);
      await audit(g.email,g.role,action==="approve"?"registration_approve":"registration_reject",reg.email,{id:reg.id});
      // notify the requester (best-effort)
      await mail(reg.email, action==="approve"?"access-approved":"access-declined", {name:reg.name||null,email:reg.email});
      return json({ok:true,id:reg.id,status:action==="approve"?"approved":"rejected",email:reg.email});
    }
    return json({error:"bad_action"},400);
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
