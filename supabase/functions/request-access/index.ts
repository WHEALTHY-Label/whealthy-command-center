// WHEALTHY — request-access v3: non-member asks to join. Creates a pending registration for an
// admin to vet. v3 sends a confirmation email to the requester + an alert to admins (via send-email).
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
const REVIEW_MSG="Your request is in. We review new stewards within 24 hours, and you'll get access once you're approved.";
async function mail(to:string, template:string, data:unknown){
  try{ await fetch(`${SUPABASE_URL}/functions/v1/send-email`,{ method:"POST", headers:{ "Content-Type":"application/json", "apikey":SERVICE, "Authorization":"Bearer "+SERVICE }, body:JSON.stringify({to,template,data}) }); }catch(_e){}
}
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const b=await req.json().catch(()=>({}));
    const email=(b.email||"").toLowerCase().trim();
    if(!email||!email.includes("@")) return json({error:"invalid_email"},400);
    const { data:mem }=await SB.from("approved_members").select("id,active,member_status").ilike("email",email);
    const m=(mem||[])[0];
    if(m && m.active!==false && m.member_status!=="banned") return json({ok:true,already_member:true,message:"You're already a Steward. Head to sign in."});
    const { data:pend }=await SB.from("pending_registrations").select("id,status,created_at").ilike("email",email).eq("status","pending").limit(1);
    if((pend||[]).length) return json({ok:true,status:"pending",already_requested:true,message:REVIEW_MSG});
    const { data:ins, error }=await SB.from("pending_registrations").insert({email,name:b.name||null,skool_handle:b.skool_handle||null,note:b.note||null,status:"pending"}).select("id").single();
    if(error){
      if(String(error.message||"").includes("duplicate")) return json({ok:true,status:"pending",already_requested:true,message:REVIEW_MSG});
      return json({error:"request_failed",detail:error.message},500);
    }
    // emails: confirmation to requester + alert to admins (best-effort, non-blocking on failure)
    await mail(email,"access-requested",{name:b.name||null,email});
    try{
      const { data:admins }=await SB.from("approved_members").select("email,admin_role").in("admin_role",["master","admin"]);
      for(const a of (admins||[])){ if(a.email) await mail(a.email,"admin-new-request",{name:b.name||null,email,skool_handle:b.skool_handle||null,note:b.note||null}); }
    }catch(_e){}
    return json({ok:true,status:"pending",request_id:ins.id,message:REVIEW_MSG});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
