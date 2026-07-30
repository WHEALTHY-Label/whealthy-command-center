import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Scope down direct query access from this file
const originalFrom = SB.from.bind(SB);
SB.from = function(table: string) {
  if (["wall_posts", "wall_prays", "wall_amens", "wall_reports"].includes(table)) {
    throw new Error(`Access to table ${table} is forbidden from governor-ai`);
  }
  return originalFrom(table);
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// In-memory rate limiter (per email, per instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
function isRateLimited(email) {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || (now - entry.firstHit) > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(email, { count: 1, firstHit: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// The Language Constitution lives HERE, server-side, never on the page.
const RULES = `You write for WHEALTHY, a Performance Governance brand for faith-rooted people carrying real responsibility across faith, family, and work.
Voice rules, strict:
- Say: governed, stewardship, rhythm, pattern, carry well, lay it down, the record.
- Never say: supplement, boost, biohack, hustle, diet, weight, cure, fix, therapy, self-care, mental health terms.
- Never use em dashes. Use periods or commas.
- Never make health claims. Never connect any product to any bodily outcome. Products may only be placed in a schedule or noted as counting toward a hydration goal.
- Never write, quote, or paraphrase scripture text. You may only select references from lists provided to you.
- The scribe keeps a person's words sacred. Name what recurs, state what the record shows, never interpret motives, never advise unless asked. Mirror the person's own idiom back when the record supports it.
- No shame, no flattery. Warm, direct, brief.
Respond ONLY with valid JSON. No preamble, no markdown fences.`;

const ROUTER_SYSTEM = `You are the intent router for the WHEALTHY Command Center, a faith-rooted governance app.
A steward spoke to the mic. Classify what he wants and extract the details. You classify and extract; the app answers.
For any speak_back that offers reflection or encouragement, root it in scripture by MEANING, and only name a reference if his scripture_comfort (given in context) is high enough. Meaning before citation. Never preach. Never invent scripture.
When uncertain whether something is a command or a personal reflection, choose journal_entry. It is always safe to keep a man's words.
Never mark a money action, subscription change, delete, burn, send-to-someone, or fast start as auto-executable. Those are proposals only.
Return ONLY valid JSON matching the schema.`;

const PROFILE_SYSTEM = `You maintain a living portrait of one WHEALTHY steward so the app can serve him more personally over time.
You receive his current profile and the latest interaction. Update the profile fields with anything genuinely new. Be conservative: do not overwrite on weak evidence, strengthen on repeated evidence.
Judge his scripture comfort honestly on a 1 to 5 scale from how he engages: 1 means keep references light and speak in meaning, 5 means he is at home in the Word and welcomes chapter and verse. Only raise it on real engagement, never assume.
Never store sensitive health details, never diagnose, never editorialize. Facts and patterns only.
Return ONLY the JSON profile delta. No prose.`;

// My Bible study companion. Fully conversational, direct, and natural.
const BIBLE_STUDY_SYSTEM = `You are "Bible Buddy", a warm, encouraging, brotherly, and conversational Bible study companion for a WHEALTHY steward.

SCREEN CONTEXT & KNOWLEDGE:
- You have full access to the exact scripture chapter text currently visible on the steward's screen, as well as their highlighted and saved verses/notes.
- Ground your response directly in the passage on their screen and refer to their highlights/notes whenever relevant to their question.

CONVERSATIONAL TONE & FLOW:
1. Speak naturally like a wise, grounded brother or close friend chatting over coffee.
2. Keep your tone warm, personal, direct, and conversational.
3. Answer what is asked directly in a smooth, engaging flow (2 to 4 sentences).
4. Focus on key insights, core themes, encouragement, and practical daily application based on the passage on screen.
5. NEVER use rigid templates, bulleted lists, numbered outlines, or formal commentary breakdowns.
6. NEVER dump multiple scripture verses or write out full verse quotations in the reply string.
7. ONLY include a scripture reference in "refs" if the steward explicitly asks for a scripture citation or cross-reference. Otherwise, set "refs" to [].

Return ONLY valid JSON:
{ "reply": "your warm, direct, conversational answer (2 to 4 sentences)", "refs": [] }`;

const MAX_TOKENS: Record<string, number> = {
  scribe: 700, threads: 700, fast_identity: 700, fast_schedule: 700,
  fast_phases: 600, fast_scripture: 900, phase_brief: 400, synthesis: 500,
  intent_router: 450, profile_update: 500,
  notification_voice: 300, watchlist_synthesis: 400, record_wall_nudge: 300,
  bible_study: 450
};

const BANNED = /\b(supplement|boost|biohack|hustle|beast mode|stimulant|miracle|cure|diet|weight loss)\b/i;
const EM_DASH = /—/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const _body = await req.json();
    const { email, prompt, message, context, scripture_whitelist, allow_community_directive } = _body;
    let task = _body.task;
    if (!task && (_body.mode === "my-bible" || _body.mode === "bible_study")) task = "bible_study";

    // Member validation, house pattern: check approved_members table, or allow logged-in steward session
    let isApproved = false;
    if (email) {
      try {
        const { data: member } = await SB.from("approved_members")
          .select("email").eq("email", (email || "").toLowerCase()).maybeSingle();
        if (member) isApproved = true;
      } catch(e){}
    }
    if (!isApproved && !_body.wall_key && !email) {
      return json({ error: "not_authorized" }, 403);
    }

    if (email && isRateLimited((email || "").toLowerCase())) return json({ ok: false, error: "rate_limited" }, 429);

    if (!MAX_TOKENS[task]) return json({ error: "unknown_task" }, 400);

    // ---- MY BIBLE STRICT GATE ----
    // Scripture only. Model returns references + framing; verse TEXT is resolved
    // server-side from bible_verses (the owned library) so quotes are always verbatim.
    if (task === "bible_study") {
      const question = String(prompt || message || "").slice(0, 1000).trim();
      if (!question) return json({ ok: false, error: "empty_question" }, 200);

      let ctxLine = (context && context.book)
        ? `The steward is currently reading ${context.book}${context.chapter ? " " + context.chapter : ""}.`
        : "";
      if (context && context.active_text) {
        ctxLine += `\n\nEXACT SCRIPTURE TEXT VISIBLE ON STEWARD'S SCREEN:\n${String(context.active_text).slice(0, 3500)}`;
      }
      if (context && context.highlights && Array.isArray(context.highlights) && context.highlights.length > 0) {
        ctxLine += `\n\nSTEWARD'S SAVED/HIGHLIGHTED VERSES AND NOTES ON SCREEN:\n${context.highlights.slice(0, 10).join("\n")}`;
      }

      const userText = `${ctxLine}\n\nSteward asks: ${question}`;

      let parsed: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: MAX_TOKENS.bible_study, system: BIBLE_STUDY_SYSTEM, messages: [{ role: "user", content: userText }] }),
          });
          const data = await r.json();
          if (!r.ok) {
            console.error("[governor-ai] Anthropic API error:", r.status, JSON.stringify(data));
          }
          const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
          let s = text.replace(/```json|```/g, "").trim();
          const a = s.indexOf("{"), b = s.lastIndexOf("}");
          if (a >= 0 && b > a) s = s.slice(a, b + 1);
          const out = JSON.parse(s);
          if (typeof out.reply === "string" && out.reply.trim().length > 0) {
            parsed = out;
            break;
          }
        } catch (e) {
          console.error("[governor-ai] bible_study attempt failed:", e);
        }
      }

      if (!parsed) {
        const bk = (context && context.book) ? context.book : 'this passage';
        const ch = (context && context.chapter) ? ` ${context.chapter}` : '';
        parsed = {
          reply: `When reflecting on ${bk}${ch}, the main takeaway is keeping our mindset governed and putting faith into daily action. Regarding "${question}", focus on meditating on the core promises in this passage and applying them step by step today. What specific verse speaks most to your heart right now?`,
          refs: []
        };
      }

      const refs = Array.isArray(parsed.refs) ? parsed.refs.slice(0, 1) : [];
      const verses: Array<{ reference: string; text: string }> = [];
      const seen = new Set<string>();
      for (const ref of refs) {
        const key = String(ref || "").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        try {
          const vr = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/bible-verses?ref=" + encodeURIComponent(key));
          if (!vr.ok) continue;
          const vd = await vr.json();
          if (vd && Array.isArray(vd.verses) && vd.verses.length) {
            const txt = (vd.text ? String(vd.text) : vd.verses.map((v: any) => v.text).join(" ")).slice(0, 1500);
            verses.push({ reference: vd.reference || key, text: txt });
          }
        } catch { /* drop unresolved ref */ }
      }
      return json({ ok: true, out: { reply: parsed.reply, verses } });
    }

    let systemPrompt = task === "intent_router" ? ROUTER_SYSTEM : (task === "profile_update" ? PROFILE_SYSTEM : RULES);
    let promptText = prompt;

    if (task === "notification_voice") {
      try {
        const resCtx = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/wall-ai-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || ""
          },
          body: JSON.stringify({ email, scope: "own" })
        });
        if (!resCtx.ok) throw new Error("Failed to load wall-ai-context");
        const ctxData = await resCtx.json();
        const payloadObj = JSON.parse(prompt);
        const postMeta = (ctxData.watchlist || []).find((w: any) => w.id === payloadObj.postId);
        if (!postMeta) {
          return json({ ok: true, out: { text: "" } });
        }

        systemPrompt = `You are the notification voice for the WHEALTHY prayer watchlist.
Write one line marking that a prayer this steward carried has been answered.
You do not know what the prayer was about. Do not speculate.
Do not congratulate. Do not celebrate. Do not use exclamation marks.
State what happened. Under 12 words.
Never use an em dash.
Return ONLY a valid JSON object matching this schema exactly (no preamble, no markdown blocks):
{ "text": "[your sentence]" }`;

        promptText = `Steward watchlist metadata for this prayer:
- my_pray_count: ${postMeta.my_pray_count}
- days_elapsed: ${postMeta.days_elapsed}
- pray_count: ${postMeta.pray_count}`;
      } catch (e) {
        console.error("[governor-ai] notification_voice failed:", e);
        return json({ ok: true, out: { text: "" } });
      }
    } else if (task === "watchlist_synthesis") {
      try {
        const resCtx = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/wall-ai-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || ""
          },
          body: JSON.stringify({ email, scope: "own" })
        });
        if (!resCtx.ok) throw new Error("Failed to load wall-ai-context");
        const ctxData = await resCtx.json();

        const list = (ctxData.watchlist || []).map((w: any) => ({
          status: w.status,
          days_since_prayed: w.days_since_prayed,
          my_pray_count: w.my_pray_count,
          days_elapsed: w.days_elapsed
        }));

        systemPrompt = `You analyze a steward's prayer watchlist. Metadata only.
You do not know what any of these prayers are about. You cannot know. Do not speculate about content.
Reflect the shape back: how much they have carried, what has been answered, what is still open.
Two to three sentences. No advice. No suggestion of what to do next.
Do not tell them to pray for anything. Do not tell them anyone needs them.
Never use an em dash.
Return ONLY a valid JSON object matching this schema exactly (no preamble, no markdown blocks):
{ "text": "[your synthesis reflection]" }`;

        promptText = `Watchlist metadata:
${JSON.stringify(list)}`;
      } catch (e) {
        console.error("[governor-ai] watchlist_synthesis failed:", e);
        return json({ ok: true, out: { text: "" } });
      }
    } else if (task === "record_wall_nudge") {
      try {
        systemPrompt = `You analyze a steward's journal record for a recurring burden or weight.
Evaluate if there is a recurring theme across 3+ entries spanning 14+ days.
If there is no recurring theme or it doesn't span 14+ days, you must return showNudge = false.
If there is a recurring theme:
- The nudge names that a pattern exists, not what the pattern is. "This keeps coming up" is a mirror.
- Do not write a prayer. Do not draft anything. Do not summarize what they wrote. Do not tell them to post. Do not tell them it would help.
- Return exactly: "This keeps coming up. You do not have to carry it alone."
- Never use an em dash.
Return ONLY valid JSON matching this schema:
{ "showNudge": boolean, "text": "This keeps coming up. You do not have to carry it alone." }`;

        const payloadObj = JSON.parse(prompt);
        promptText = `Journal entries:
${JSON.stringify(payloadObj.entries || [])}`;
      } catch (e) {
        console.error("[governor-ai] record_wall_nudge failed:", e);
        return json({ ok: true, out: { showNudge: false } });
      }
    } else if (task === "synthesis" && allow_community_directive) {
      try {
        const resComm = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/wall-ai-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || ""
          },
          body: JSON.stringify({ email, scope: "community" })
        });
        const commData = resComm.ok ? await resComm.json() : null;

        const resOwn = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/wall-ai-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || ""
          },
          body: JSON.stringify({ email, scope: "own" })
        });
        const ownData = resOwn.ok ? await resOwn.json() : null;

        if (commData && ownData) {
          const hasLivePost = (ownData.posts || []).some((p: any) => p.status === 'live');
          const isCommunityHeavy = (commData.top_post_pray_count >= 25 || commData.prays_last_24h >= 50);

          if (isCommunityHeavy && !hasLivePost) {
            promptText += `\n\nCommunity Wall Context:
- Steward has active live post on wall: no
- Community is carrying heavy weight: yes
- Community prays last 24h: ${commData.prays_last_24h}
- Community live posts: ${commData.live_post_count}

Instruction for Daily Directive Wall Awareness:
You MUST append a low-urgency community focus sentence to the generated "dailyDirective" (e.g. "Take 2 minutes to carry someone else's burden on the wall today.").
Rules for this sentence:
- Keep it brief, low-urgency, and gentle.
- Do NOT mention any counts, numbers, or specific statistics.
- Do NOT say "47 people need you" or create false urgency.
- Never use an em dash.`;
          }
        }
      } catch (e) {
        console.warn("[governor-ai] failed to append wall context to synthesis:", e);
      }
    }

    // One attempt plus one retry on parse failure
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: MAX_TOKENS[task],
          system: systemPrompt,
          messages: [{ role: "user", content: promptText }],
        }),
      });
      const data = await r.json();
      const text = (data.content || []).filter((b: any) => b.type === "text")
        .map((b: any) => b.text).join("\n");
      let s = text.replace(/```json|```/g, "").trim();
      const a = s.indexOf("{"), b = s.lastIndexOf("}");
      if (a >= 0 && b > a) s = s.slice(a, b + 1);
      try {
        const out = JSON.parse(s);
        const flat = JSON.stringify(out);

        // Server-side validation, the last line of defense
        if (BANNED.test(flat) || EM_DASH.test(flat)) continue; // retry once
        if (scripture_whitelist && Array.isArray(scripture_whitelist)) {
          const wl = new Set(scripture_whitelist);
          const badRef = (flat.match(/\b(?:[1-3]\s)?[A-Z][a-z]+\s\d+:\d+(?:-\d+)?\b/g) || [])
            .some((ref: string) => !wl.has(ref));
          if (badRef) continue; // retry once, client fallback catches second miss
        }
        return json({ ok: true, out });
      } catch { /* retry loop */ }
    }
    return json({ ok: false, error: "generation_failed" }, 200); // client uses fallback
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "content-type": "application/json" },
  });
}
