// WHEALTHY — shopify-order-webhook v1: receives Shopify order + fulfillment webhooks, verifies HMAC,
// matches the order to a member by email, and upserts into member_orders (with tracking). Public endpoint
// (Shopify posts here). Set SHOPIFY_WEBHOOK_SECRET in Supabase to enforce HMAC; until then it accepts and logs unsigned.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET")||"";
async function verifyHmac(raw:string, header:string){
  if(!SECRET) return true; // not configured yet
  try{
    const key=await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
    const sig=await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    const b64=btoa(String.fromCharCode(...new Uint8Array(sig)));
    return b64===header;
  }catch(_e){ return false; }
}
async function matchMember(email:string){
  if(!email||!email.includes("@")) return null;
  const {data}=await SB.from("approved_members").select("email").ilike("email",email).maybeSingle();
  return data? (data.email as string).toLowerCase() : null;
}
Deno.serve(async (req)=>{
  if(req.method!=="POST") return new Response("method",{status:405});
  const raw=await req.text();
  const hmac=req.headers.get("x-shopify-hmac-sha256")||"";
  if(!(await verifyHmac(raw,hmac))) return new Response("unauthorized",{status:401});
  const topic=(req.headers.get("x-shopify-topic")||"").toLowerCase();
  let body:any; try{ body=JSON.parse(raw); }catch(_e){ return new Response("bad_json",{status:400}); }
  try{
    if(topic.startsWith("orders/")){
      const o=body;
      const email=(o.email||o.contact_email||(o.customer&&o.customer.email)||"").toLowerCase();
      const member=await matchMember(email);
      const items=(o.line_items||[]).map((li:any)=>({title:li.title,quantity:li.quantity,price:li.price,variant:li.variant_title||null}));
      let tc=null,tn=null,tu=null;
      const f=(o.fulfillments||[]).slice(-1)[0];
      if(f){ tc=f.tracking_company||null; tn=f.tracking_number||(f.tracking_numbers&&f.tracking_numbers[0])||null; tu=f.tracking_url||(f.tracking_urls&&f.tracking_urls[0])||null; }
      await SB.from("member_orders").upsert({
        shopify_order_id:String(o.id), order_number:o.name||null, email:email||null, member_email:member,
        financial_status:o.financial_status||null, fulfillment_status:o.fulfillment_status||null,
        line_items:items, total_price:o.total_price?Number(o.total_price):null, currency:o.currency||null,
        tracking_company:tc, tracking_number:tn, tracking_url:tu,
        ordered_at:o.created_at||null, fulfilled_at:(o.fulfillment_status==="fulfilled"? new Date().toISOString():null),
        raw:o, updated_at:new Date().toISOString()
      },{onConflict:"shopify_order_id"});
    } else if(topic.startsWith("fulfillments/")){
      const f=body; const oid=String(f.order_id||"");
      if(oid){
        const tn=f.tracking_number||(f.tracking_numbers&&f.tracking_numbers[0])||null;
        const tu=f.tracking_url||(f.tracking_urls&&f.tracking_urls[0])||null;
        const tc=f.tracking_company||null;
        await SB.from("member_orders").update({ tracking_company:tc, tracking_number:tn, tracking_url:tu, fulfillment_status:"fulfilled", fulfilled_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("shopify_order_id",oid);
      }
    }
    return new Response("ok");
  }catch(e){ return new Response("err:"+String(e),{status:200}); }
});
