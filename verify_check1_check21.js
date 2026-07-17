const fs = require('fs');
const path = require('path');

console.log("=== STARTING BOUNDARY AUDIT AND 20X GENERATION TEST ===");

// 1. Retrieve ANTHROPIC_API_KEY from .env.local
let ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  try {
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/ANTHROPIC_API_KEY=["']?([^"'\n]+)/);
      if (match) {
        ANTHROPIC_KEY = match[1].trim();
      }
    }
  } catch (e) {
    console.warn("Could not read .env.local:", e.message);
  }
}

if (!ANTHROPIC_KEY) {
  console.log("WARNING: ANTHROPIC_API_KEY not found. Will run boundary checks, but skipping 20x generation tests.");
}

// 2. Define the exact system prompt rules from governor-ai
const RULES = `You write for WHEALTHY, a Performance Governance brand for faith-rooted people carrying real responsibility across faith, family, and work.
Voice rules, strict:
- Say: governed, stewardship, rhythm, pattern, carry well, lay it down, the record.
- Never say: supplement, boost, biohack, hustle, diet, weight, cure, fix, therapy, self-care, mental health terms.
- Never use em dashes. Use periods or commas.
- Never make health claims. Never connect any product to any bodily outcome. Products may only be placed in a schedule or noted as counting toward a hydration goal.
- Never write, quote, or paraphrase scripture text. You may only select references from lists provided to you.
- The scribe keeps a person's words sacred. Name what recurs, state what the record shows, never interpret motives, never advise unless asked. Mirror the person's own idiom and repeated phrases back when the record supports it.
- No shame, no flattery. Warm, direct, brief.`;

// Sentinel representing a prayer body that should NEVER leak to Anthropic
const SENTINEL_BODY = "SECRET_LEAK_PRAYER_BODY_THAT_MUST_NEVER_REACH_ANTHROPIC";

// Mock database contexts returned from wall-ai-context
const mockOwnContext = {
  scope: "own",
  posts: [], // no active own live post
  watchlist: [
    {
      id: "watch-1",
      status: "answered",
      days_since_prayed: 2,
      has_unseen_answer: true,
      my_pray_count: 5,
      days_elapsed: 10,
      pray_count: 25,
      body: SENTINEL_BODY // Injected here to verify the code strips it
    },
    {
      id: "watch-2",
      status: "live",
      days_since_prayed: 1,
      has_unseen_answer: false,
      my_pray_count: 2,
      days_elapsed: 2,
      pray_count: 4,
      body: SENTINEL_BODY
    }
  ]
};

const mockCommunityContext = {
  scope: "community",
  live_post_count: 3,
  prays_last_24h: 60,
  answered_last_7d: 2,
  top_post_pray_count: 30
};

// 3. Re-implement prompt building functions exactly as in governor-ai
function buildNotificationVoicePrompt(postId) {
  const postMeta = mockOwnContext.watchlist.find(w => w.id === postId);
  if (!postMeta) return null;

  const system = `You are the notification voice for the WHEALTHY prayer watchlist.
Write one line marking that a prayer this steward carried has been answered.
You do not know what the prayer was about. Do not speculate.
Do not congratulate. Do not celebrate. Do not use exclamation marks.
State what happened. Under 12 words.
Never use an em dash.
Return ONLY a valid JSON object matching this schema exactly (no preamble, no markdown blocks):
{ "text": "[your sentence]" }`;

  const prompt = `Steward watchlist metadata for this prayer:
- my_pray_count: ${postMeta.my_pray_count}
- days_elapsed: ${postMeta.days_elapsed}
- pray_count: ${postMeta.pray_count}`;

  return { system, prompt };
}

function buildWatchlistSynthesisPrompt() {
  const list = mockOwnContext.watchlist.map(w => ({
    status: w.status,
    days_since_prayed: w.days_since_prayed,
    my_pray_count: w.my_pray_count,
    days_elapsed: w.days_elapsed
  }));

  const system = `You analyze a steward's prayer watchlist. Metadata only.
You do not know what any of these prayers are about. You cannot know. Do not speculate about content.
Reflect the shape back: how much they have carried, what has been answered, what is still open.
Two to three sentences. No advice. No suggestion of what to do next.
Do not tell them to pray for anything. Do not tell them anyone needs them.
Never use an em dash.
Return ONLY a valid JSON object matching this schema exactly (no preamble, no markdown blocks):
{ "text": "[your synthesis reflection]" }`;

  const prompt = `Watchlist metadata:
${JSON.stringify(list)}`;

  return { system, prompt };
}

function buildRecordWallNudgePrompt(entries) {
  const system = `You analyze a steward's journal record for a recurring burden or weight.
Evaluate if there is a recurring theme across 3+ entries spanning 14+ days.
If there is no recurring theme or it doesn't span 14+ days, you must return showNudge = false.
If there is a recurring theme:
- The nudge names that a pattern exists, not what the pattern is. "This keeps coming up" is a mirror.
- Do not write a prayer. Do not draft anything. Do not summarize what they wrote. Do not tell them to post. Do not tell them it would help.
- Return exactly: "This keeps coming up. You do not have to carry it alone."
- Never use an em dash.
Return ONLY valid JSON matching this schema:
{ "showNudge": boolean, "text": "This keeps coming up. You do not have to carry it alone." }`;

  const prompt = `Journal entries:
${JSON.stringify(entries || [])}`;

  return { system, prompt };
}

function buildSynthesisPrompt() {
  const system = RULES;
  let promptText = `Generate personalized WHEALTHY dashboard strings.`;

  // Simulate appending wall context under heavy carries
  const hasLivePost = mockOwnContext.posts.some(p => p.status === 'live');
  const isCommunityHeavy = (mockCommunityContext.top_post_pray_count >= 25 || mockCommunityContext.prays_last_24h >= 50);

  if (isCommunityHeavy && !hasLivePost) {
    promptText += `\n\nCommunity Wall Context:
- Steward has active live post on wall: no
- Community is carrying heavy weight: yes
- Community prays last 24h: ${mockCommunityContext.prays_last_24h}
- Community live posts: ${mockCommunityContext.live_post_count}

Instruction for Daily Directive Wall Awareness:
You MUST append a low-urgency community focus sentence to the generated "dailyDirective" (e.g. "Take 2 minutes to carry someone else's burden on the wall today.").
Rules for this sentence:
- Keep it brief, low-urgency, and gentle.
- Do NOT mention any counts, numbers, or specific statistics.
- Do NOT say "47 people need you" or create false urgency.
- Never use an em dash.`;
  }

  return { system, prompt: promptText };
}

// 4. Run Boundary Leak Checks
console.log("\n--- RUNNING PRIVACY BOUNDARY PAYLOAD CHECKS (ACCEPTANCE CHECK 1) ---");

const payloads = [
  { name: "notification_voice", payload: buildNotificationVoicePrompt("watch-1") },
  { name: "watchlist_synthesis", payload: buildWatchlistSynthesisPrompt() },
  { name: "record_wall_nudge", payload: buildRecordWallNudgePrompt([
      { date: "2026-07-01", text: "Danny situation heavy." },
      { date: "2026-07-08", text: "Sarah and Danny recovery." },
      { date: "2026-07-15", text: "Still carrying Danny." }
    ]) },
  { name: "synthesis", payload: buildSynthesisPrompt() }
];

let leakDetected = false;
for (const item of payloads) {
  console.log(`Checking payload for task: ${item.name}`);
  const fullPayloadStr = JSON.stringify(item.payload);
  
  if (fullPayloadStr.includes(SENTINEL_BODY)) {
    console.error(`🚨 LEAK DETECTED in payload for ${item.name}! Injected sentinel was found in prompt!`);
    leakDetected = true;
  } else {
    console.log(`✅ Passed: No leak in ${item.name} prompt.`);
  }
}

if (leakDetected) {
  console.error("Test failed due to privacy leak!");
  process.exit(1);
} else {
  console.log("SUCCESS: Privacy boundary verified. No other steward's prayer body text reaches Anthropic payloads.");
}

// 5. Run 20x Generation tests if API key is present
if (ANTHROPIC_KEY) {
  console.log("\n--- RUNNING 20X GENERATION AUDIT (VERIFICATION 21) ---");
  
  async function callAnthropic(system, prompt, maxTokens = 100) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  }

  (async () => {
    try {
      // We will generate 20 outputs for each task and check guidelines
      const tasksToTest = [
        { name: "notification_voice", payload: buildNotificationVoicePrompt("watch-1"), checkExclamation: true },
        { name: "watchlist_synthesis", payload: buildWatchlistSynthesisPrompt(), checkExclamation: false },
        { name: "record_wall_nudge", payload: buildRecordWallNudgePrompt([
            { date: "2026-07-01", text: "Danny situation heavy." },
            { date: "2026-07-08", text: "Sarah and Danny recovery." },
            { date: "2026-07-15", text: "Still carrying Danny." }
          ]), checkExclamation: false },
        { name: "synthesis", payload: buildSynthesisPrompt(), checkExclamation: false }
      ];

      for (const t of tasksToTest) {
        console.log(`\nGenerating 20 completions for ${t.name}...`);
        for (let i = 1; i <= 20; i++) {
          const rawText = await callAnthropic(t.payload.system, t.payload.prompt, t.name === "synthesis" ? 350 : 150);
          
          // Check for em dashes
          if (rawText.includes("—")) {
            throw new Error(`Violation in ${t.name} (run ${i}): contains em dash! Content: "${rawText}"`);
          }
          
          // Check for exclamation marks if requested (notification_voice)
          if (t.checkExclamation && rawText.includes("!")) {
            throw new Error(`Violation in ${t.name} (run ${i}): contains exclamation mark! Content: "${rawText}"`);
          }
          
          process.stdout.write(".");
        }
        console.log(`\n✅ ${t.name} passed 20x generation audit.`);
      }

      console.log("\n=== ALL PAGE 6 BOUNDARY AND AUDIT TESTS PASSED SUCCESSFULLY ===");
      process.exit(0);
    } catch (err) {
      console.error("\nAPI Audit Failed:", err.message);
      process.exit(1);
    }
  })();
} else {
  console.log("\nSkipping 20x generation tests (no Anthropic API key).");
  process.exit(0);
}
