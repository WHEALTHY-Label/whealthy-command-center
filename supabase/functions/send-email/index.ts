// WHEALTHY — send-email v5: shared transactional sender. v5 fixes the header wordmark: Oswald font
// (Arial Narrow fallback) + correct W(white) HEAL(lime) THY(white) split. 12 templates. Kill-switch unchanged.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")||"";
const FROM = Deno.env.get("RESEND_FROM") || "WHEALTHY Stewards <hello@thestewardsrhythm.com>";
const APP_URL = "https://www.thestewardsrhythm.com";
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function json(b:unknown,s=200){ return new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}}); }
function esc(s:unknown){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!)); }
function shell(inner:string, preheader=""){
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap" rel="stylesheet"></head><body style="margin:0;background:#f4f2ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">`+
  (preheader?`<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>`:``)+
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:28px 12px;"><tr><td align="center">`+
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">`+
  `<tr><td style="background:#0e0f11;padding:22px 28px;"><span style="font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:700;font-size:23px;letter-spacing:0.09em;text-transform:uppercase;color:#ffffff;">W<span style="color:#ccff00;">HEAL</span>THY</span><div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:3px;">The Steward's Rhythm</div></td></tr>`+
  `<tr><td style="padding:32px 28px 8px;font-size:16px;line-height:1.65;color:#26251f;">${inner}</td></tr>`+
  `<tr><td style="padding:20px 28px 30px;"><div style="border-top:1px solid #eee;padding-top:16px;font-size:12px;line-height:1.6;color:#9a988f;">You're receiving this because you stepped toward the WHEALTHY Stewards. Carry well.<br>WHEALTHY · The Steward's Rhythm</div></td></tr>`+
  `</table></td></tr></table></body></html>`;
}
const btn=(href:string,label:string)=>`<a href="${esc(href)}" style="display:inline-block;background:#ccff00;color:#0e0f11;font-weight:700;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:10px;letter-spacing:0.02em;">${label}</a>`;
const p=(s:string)=>`<p style="margin:0 0 16px;">${s}</p>`;
const ol=(items:string[])=>`<div style="margin:0 0 18px;">`+items.map((it,i)=>`<div style="display:flex;gap:11px;margin:0 0 11px;align-items:flex-start;"><div style="flex:none;width:23px;height:23px;border-radius:7px;background:rgba(204,255,0,0.16);color:#5a7d00;font-weight:700;font-size:12px;text-align:center;line-height:23px;">${i+1}</div><div style="font-size:15px;line-height:1.5;color:#26251f;">${it}</div></div>`).join("")+`</div>`;
const link=(href:string,label:string)=>`<a href="${esc(href)}" style="color:#5a7d00;font-weight:700;">${label}</a>`;
async function settings(){ const { data }=await SB.from("site_settings").select("key,value"); const m:Record<string,string>={}; (data||[]).forEach((r:any)=>{ m[r.key]=r.value; }); return m; }
const firstName=(name?:string)=>{ const n=(name||"").trim().split(/\s+/)[0]; return n||"steward"; };

async function render(template:string, d:any){
  const name=firstName(d.name);
  if(template==="access-requested"){
    return { subject:"Your request is in, steward.", html: shell(
      p(`Good to have you knocking, ${esc(name)}.`)+
      p(`We got your request for access to <b>The Steward's Rhythm</b>, the governance system built to help you carry your energy the way you steward everything else that matters. We look at every steward by hand, usually within 24 hours.`)+
      p(`Keep an eye on this inbox. The moment you're cleared, your way in comes right here.`)+
      p(`Carry well,<br>The WHEALTHY Stewards`), "Your request for The Steward's Rhythm is in. We review within 24 hours.") };
  }
  if(template==="admin-new-request"){
    return { subject:`New steward request: ${d.email||"unknown"}`, html: shell(
      p(`A new steward asked to come in.`)+
      `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7;color:#444;margin:0 0 16px;">`+
      `<tr><td style="padding-right:12px;color:#9a988f;">Name</td><td>${esc(d.name||"—")}</td></tr>`+
      `<tr><td style="padding-right:12px;color:#9a988f;">Email</td><td>${esc(d.email||"—")}</td></tr>`+
      `<tr><td style="padding-right:12px;color:#9a988f;">Skool</td><td>${esc(d.skool_handle||"—")}</td></tr>`+
      `<tr><td style="padding-right:12px;color:#9a988f;vertical-align:top;">Note</td><td>${esc(d.note||"—")}</td></tr>`+
      `</table>`+
      p(`Vet them in the Surface tab when you get a minute.`)+
      p(btn(`${APP_URL}/#admin`,"Open Surface")), "A new steward is waiting to be vetted.") };
  }
  if(template==="access-approved"){
    const s=await settings(); const skool=s.skool_join_url||"https://www.skool.com/bakndcreator";
    return { subject:"You're in. Welcome to The Steward's Rhythm.", html: shell(
      p(`Welcome in, ${esc(name)}. This is a good day.`)+
      p(`You're approved, and <b>The Steward's Rhythm</b> is open to you now — your own governance system for energy, focus, and the disciplines that hold a life together.`)+
      p(btn(`${APP_URL}`,"Step into your Rhythm"))+
      p(`Here's how to start strong:`)+
      ol([
        `<b>Take the 60-second quiz.</b> It names your energy pattern and builds your rhythm around it.`,
        `<b>Set your rhythm.</b> Start with one or two anchors, and grow it as they hold.`,
        `<b>Step into the house.</b> Meet the other stewards and see who's carrying what you carry.`
      ])+
      p(`The WHEALTHY Stewards community on Skool is where the daily life of the house happens. Share your results, ask anything you're wondering, and know you're never carrying it alone: ${link(skool,"Step into the community →")}`)+
      p(`Glad you're here. Carry well,<br>The WHEALTHY Stewards`), "You're in. Here's how to start The Steward's Rhythm.") };
  }
  if(template==="access-declined"){
    return { subject:"About your Steward's Rhythm request", html: shell(
      p(`${esc(name)}, thank you for reaching toward The Steward's Rhythm.`)+
      p(`We're not able to open it to you right now. That's not a door closed on you — the Rhythm is held close on purpose, and timing matters.`)+
      p(`If your season changes, you're welcome to reach out again. No hard feelings, only good will.`)+
      p(`Carry well,<br>The WHEALTHY Stewards`), "A note about your request.") };
  }
  if(template==="quiz-results"){
    const s=await settings(); const skool=s.skool_join_url||"https://www.skool.com/bakndcreator"; const pct=s.member_discount_pct||"10";
    return { subject:`Your pattern: ${d.pattern||"named"}`, html: shell(
      p(`So here's what we see in you, ${esc(name)}.`)+
      `<div style="background:#f7f6f2;border-left:3px solid #ccff00;border-radius:8px;padding:16px 18px;margin:0 0 18px;"><div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#9a988f;margin-bottom:4px;">Your pattern</div><div style="font-size:19px;font-weight:700;color:#1a1a1a;">${esc(d.pattern||"Your energy pattern")}</div>${d.bundle?`<div style="font-size:14px;color:#555;margin-top:8px;">Matched rhythm: <strong>${esc(d.bundle)}</strong></div>`:``}</div>`+
      p(`This isn't a diagnosis, and it's not a label to carry. It's a pattern — and the good news is that once you can see it, you can govern it instead of letting it run your day.`)+
      p(`Come tell the house. Share your pattern in the WHEALTHY Stewards community, see who's in it with you, and ask anything you're still wondering — that's where a result turns into a rhythm. Your <b>${esc(pct)}% member code</b> is waiting inside, claimed free when you step in:`)+
      p(btn(skool,"Claim your code &amp; meet the house"))+
      p(`See you in there,<br>The WHEALTHY Stewards`), `Your pattern is named. Your ${esc(pct)}% code and the house are inside.`) };
  }
  if(template==="rhythm-activated"){
    const s=await settings(); const skool=s.skool_join_url||"https://www.skool.com/bakndcreator";
    return { subject:"Your rhythm is live.", html: shell(
      p(`It's set, ${esc(name)}.`)+
      p(`Your rhythm is active. Open it any morning and check off what you carried — green means done, a soft mark is a grace day, and nothing breaks if you miss one.`)+
      p(btn(`${APP_URL}/#rhythm`,"Open your Rhythm"))+
      p(`Want it on your calendar? Sync it from the rhythm page and it'll ride alongside the rest of your day.`)+
      p(`And when the days start stacking, come tell the house — the WHEALTHY Stewards community is where wins get shared and questions get answered: ${link(skool,"Into the community →")}`)+
      p(`Carry well,<br>The WHEALTHY Stewards`), "Your daily rhythm is active.") };
  }
  if(template==="weekly-fresh-start"){
    const s=await settings(); const skool=s.skool_join_url||"https://www.skool.com/bakndcreator";
    const held=(d.last_week_done!=null)?`Last week you held ${esc(d.last_week_done)} day${Number(d.last_week_done)===1?"":"s"}, and that counts. `:"";
    return { subject:"A new week, steward.", html: shell(
      p(`Morning, ${esc(name)}.`)+
      p(`${held}However last week landed, today's a clean page — that's the gift of a rhythm, it starts over right alongside you.`)+
      p(btn(`${APP_URL}/#rhythm`,"Set your week"))+
      p(`And if last week held something worth sharing — a win, a hard day, a question — bring it to the house. The stewards are right there with you: ${link(skool,"Into the community →")}`)+
      p(`Carry well,<br>The WHEALTHY Stewards`), "A new week, a clean page.") };
  }
  if(template==="slip-nudge"){
    const anchor=d.anchor?esc(d.anchor).toLowerCase():"rhythm";
    return { subject:"No shame, just pick it back up.", html: shell(
      p(`${esc(name)}, a gentle nudge.`)+
      p(`Your ${anchor} slipped a little this past week. That's not a failure, it's just a pattern doing what patterns do when the load gets heavy.`)+
      p(`Missing a day never undoes the work. Pick it back up when you can, one day is all it takes to be back in rhythm.`)+
      p(btn(`${APP_URL}/#rhythm`,"Open your Rhythm"))+
      p(`Carry well,<br>The WHEALTHY Stewards`), "No shame. Just pick it back up.") };
  }
  if(template==="member-welcome"){
    const s=await settings(); const skool=s.skool_join_url||"https://www.skool.com/bakndcreator";
    return { subject:"Welcome home, steward.", html: shell(
      p(`You're in, ${esc(name)}. Welcome to the Stewards.`)+
      p(`You joined the house, and <b>The Steward's Rhythm</b> is waiting for you inside — your governance system for energy, focus, and the disciplines that hold a life together. Here's your door:`)+
      p(btn(`${APP_URL}`,"Open your Rhythm"))+
      p(`Three things to get you moving:`)+
      ol([
        `<b>Take the 60-second quiz.</b> It names your energy pattern and builds your rhythm around it.`,
        `<b>Set your rhythm.</b> Start with one or two anchors, and grow it as they hold.`,
        `<b>Say hey in the house.</b> Introduce yourself and see who's carrying what you carry.`
      ])+
      p(`The WHEALTHY Stewards community on Skool is where the daily life happens. Share, ask anything, and know you're never carrying it alone: ${link(skool,"Step into the community →")}`)+
      p(`Glad you're here. Carry well,<br>The WHEALTHY Stewards`), "Welcome to the Stewards. Your Rhythm is waiting inside.") };
  }
  if(template==="take-assessment"){
    return { subject:"Let's name your pattern, steward.", html: shell(
      p(`${esc(name)}, one move makes everything in the Rhythm click: naming your pattern.`)+
      p(`It's a 60-second assessment. It names how your energy actually moves through a day, then builds your daily rhythm around <i>you</i> instead of a one-size template.`)+
      p(btn(`${APP_URL}/#rhythm`,"Name my pattern"))+
      p(`Once it's named, your rhythm, your products, and your reminders all line up to it. That's the whole point.`)+
      p(`Carry well,<br>The WHEALTHY Stewards`), "Name your pattern and your rhythm builds itself.") };
  }
  if(template==="member-day2-nudge"){
    return { subject:"Your next step, steward.", html: shell(
      p(`${esc(name)}, you're a couple days in. No rush — just a nudge.`)+
      p(`The stewards who stick don't do it all at once. They set one anchor and let it hold. If you've got a minute, here's where to pick it back up:`)+
      p(btn(`${APP_URL}/#rhythm`,"Open your Rhythm"))+
      p(`Carry well,<br>The WHEALTHY Stewards`), "One small step keeps the rhythm going.") };
  }
  if(template==="member-day7-recap"){
    const s=await settings(); const skool=s.skool_join_url||"https://www.skool.com/bakndcreator";
    return { subject:"One week in, steward.", html: shell(
      p(`A week in, ${esc(name)}. That's worth marking.`)+
      p(`However this first week went, the rhythm is yours now — and it starts fresh with you every single day. That's the gift of it. Keep carrying.`)+
      p(btn(`${APP_URL}/#rhythm`,"Open your Rhythm"))+
      p(`And if week one held something worth sharing — a win, a hard day, a question — bring it to the house: ${link(skool,"Into the community →")}`)+
      p(`Carry well,<br>The WHEALTHY Stewards`), "One week in. Keep carrying.") };
  }
  return null;
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  const h=req.headers.get("Authorization")||req.headers.get("authorization")||"";
  const tok=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(tok!==SERVICE_KEY) return json({error:"not_authorized"},401);
  try{
    const b=await req.json().catch(()=>({}));
    const to=(b.to||"").toString().trim();
    const template=(b.template||"").toString();
    const data=b.data||{};
    if(!to||!to.includes("@")) return json({error:"bad_to"},400);
    const r=await render(template,data);
    if(!r) return json({error:"unknown_template",template},400);
    const st=await settings();
    const enabled=(st.email_enabled||"false").toLowerCase()==="true";
    if(!enabled || b.dry_run){
      await SB.from("email_log").insert({to_email:to,template,subject:r.subject,status:"held",error:b.dry_run?"dry_run":"email_disabled",meta:data});
      return json({ok:true,held:true,reason:b.dry_run?"dry_run":"email_disabled",to,subject:r.subject});
    }
    if(!RESEND_KEY){ await SB.from("email_log").insert({to_email:to,template,subject:r.subject,status:"failed",error:"no_resend_key",meta:data}); return json({error:"no_resend_key"},500); }
    const resp=await fetch("https://api.resend.com/emails",{ method:"POST", headers:{ "Authorization":"Bearer "+RESEND_KEY, "Content-Type":"application/json" }, body:JSON.stringify({ from:b.from||FROM, to:[to], subject:r.subject, html:r.html }) });
    const out=await resp.json().catch(()=>({}));
    if(!resp.ok){ await SB.from("email_log").insert({to_email:to,template,subject:r.subject,status:"failed",error:JSON.stringify(out).slice(0,500),meta:data}); return json({error:"send_failed",detail:out},502); }
    await SB.from("email_log").insert({to_email:to,template,subject:r.subject,status:"sent",resend_id:out.id||null,meta:data});
    return json({ok:true,id:out.id||null,to,template});
  }catch(e){ return json({error:"server_error",detail:String(e)},500); }
});
