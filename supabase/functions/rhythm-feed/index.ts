// WHEALTHY — rhythm-feed: subscribable ICS calendar for an active plan (token-auth, no login).
// Floating local times so reminders fire at the steward's local clock. VALARM on each event.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"GET, OPTIONS" };
const BYDAY=["MO","TU","WE","TH","FR","SA","SU"]; // bit 0..6 = Mon..Sun
const WIN_DEFAULT:Record<string,string>={morning:"08:00",midday:"12:00",afternoon:"15:00",evening:"21:00"};
function esc(s:string){ return (s||"").replace(/([,;\\])/g,"\\$1").replace(/\n/g,"\\n"); }
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  try{
    const url=new URL(req.url);
    const token=url.searchParams.get("token")||"";
    if(!token) return new Response("missing token",{status:400,headers:CORS});
    const { data:plan }=await SB.from("rhythm_plans").select("id,name,member_email").eq("ics_token",token).eq("status","active").limit(1).maybeSingle();
    if(!plan) return new Response("not found",{status:404,headers:CORS});
    const { data:slots }=await SB.from("rhythm_slots").select("id,title,if_then_text,cue_value,day_mask,time_window,duration_min").eq("plan_id",plan.id).eq("active",true).order("sort_order");
    const L:string[]=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//WHEALTHY//The Stewards Rhythm//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:My Rhythm","X-WR-TIMEZONE:UTC"];
    const anchor="20240101"; // a Monday; RRULE handles recurrence
    for(const s of (slots||[])){
      const hhmm=(s.cue_value||"").match(/^(\d{1,2}):(\d{2})$/)? s.cue_value : (WIN_DEFAULT[s.time_window]||"08:00");
      const [H,M]=hhmm.split(":"); const start=anchor+"T"+H.padStart(2,"0")+M+"00";
      const dur=s.duration_min||10; const endMin=(parseInt(H)*60+parseInt(M)+dur); const eh=String(Math.floor(endMin/60)%24).padStart(2,"0"); const em=String(endMin%60).padStart(2,"0"); const end=anchor+"T"+eh+em+"00";
      const mask=s.day_mask??127; let rrule="FREQ=DAILY";
      if(mask!==127){ const days=BYDAY.filter((_,i)=>mask&(1<<i)); rrule="FREQ=WEEKLY;BYDAY="+(days.join(",")||"MO"); }
      L.push("BEGIN:VEVENT","UID:"+s.id+"@whealthy","DTSTAMP:"+anchor+"T000000Z","DTSTART:"+start,"DTEND:"+end,"RRULE:"+rrule,"SUMMARY:"+esc(s.title),"DESCRIPTION:"+esc(s.if_then_text||""),"BEGIN:VALARM","TRIGGER:-PT0M","ACTION:DISPLAY","DESCRIPTION:"+esc(s.title),"END:VALARM","END:VEVENT");
    }
    L.push("END:VCALENDAR");
    return new Response(L.join("\r\n"),{status:200,headers:{...CORS,"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":'inline; filename="whealthy-rhythm.ics"'}});
  }catch(e){ return new Response("error: "+String(e),{status:500,headers:CORS}); }
});
