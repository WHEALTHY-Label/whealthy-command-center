import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

const MAX_TOKENS: Record<string, number> = {
  scribe: 700, threads: 700, fast_identity: 700, fast_schedule: 700,
  fast_phases: 600, fast_scripture: 900, phase_brief: 400, synthesis: 500,
  intent_router: 450, profile_update: 500,
};

const BANNED = /\b(supplement|boost|biohack|hustle|beast mode|stimulant|miracle|cure|diet|weight loss)\b/i;
const EM_DASH = /\u2014/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { email, task, prompt, scripture_whitelist } = await req.json();

    // Member validation, house pattern
    const { data: member } = await SB.from("approved_members")
      .select("email").eq("email", (email || "").toLowerCase()).maybeSingle();
    if (!member) return json({ error: "not_authorized" }, 403);

    if (isRateLimited((email || "").toLowerCase())) return json({ ok: false, error: "rate_limited" }, 429);

    if (!MAX_TOKENS[task]) return json({ error: "unknown_task" }, 400);

    const systemPrompt = task === "intent_router" ? ROUTER_SYSTEM : (task === "profile_update" ? PROFILE_SYSTEM : RULES);

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
          model: "claude-sonnet-5",
          max_tokens: MAX_TOKENS[task],
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
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
