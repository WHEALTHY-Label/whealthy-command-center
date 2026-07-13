# WHEALTHY | CHANGE LOG | July 13, 2026
### Freemium Migration Fixes | Executed directly by Claude (Cowork session) against live Supabase + local page files

> **Antigravity: read this as ground truth.** Everything below is ALREADY DONE. Do not re-apply, do not revert, do not regenerate these files from older context docs. The context docs (01-07, CLAUDE.md) still describe the old $79 model and are now BEHIND this changelog until WO-13 (doc sync) runs. Where this changelog and the context docs disagree, this changelog wins.

> Backups: pre-change copies of the 4 edited HTML files and a full JSON export of approved_members (11 rows) were taken before any change.

---

## 1. SUPABASE | MIGRATIONS APPLIED (live project yzaxzmuuvozonhgwhlim)

### Migration `freemium_wo1_security_patch`
```sql
-- 1. Public affiliates view (name + ref_id only) for the homepage badge lookup
CREATE OR REPLACE VIEW public.public_affiliates AS
  SELECT name, ref_id FROM public.affiliates;
GRANT SELECT ON public.public_affiliates TO anon, authenticated;

-- 2. Lock down approved_members: no public reads
DROP POLICY IF EXISTS "Allow public read access" ON public.approved_members;

-- 3. Lock down affiliates base table: view is the only public surface
DROP POLICY IF EXISTS "Allow public read access to affiliates" ON public.affiliates;

-- 4. Enable RLS on exposed tables (service-role edge functions bypass RLS)
ALTER TABLE public.nurture_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profile ENABLE ROW LEVEL SECURITY;

-- 5. Source normalization backfill
UPDATE public.approved_members SET source = 'quiz' WHERE source = 'Main Quiz';
```

### Migration `freemium_wo2_schema_additions`
```sql
ALTER TABLE public.approved_members
  ADD COLUMN IF NOT EXISTS member_status text NOT NULL DEFAULT 'lead';
UPDATE public.approved_members SET member_status = 'lead' WHERE member_status IS NULL OR member_status = '';

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: only service role can touch it

INSERT INTO public.site_settings (key, value)
VALUES ('member_discount_code', 'WHSBGN'), ('member_discount_pct', '20')
ON CONFLICT (key) DO NOTHING;
```

### Resulting DB state (verified)
- `approved_members`: public SELECT policy GONE. Only "Allow service role insert only" remains. New column `member_status` (values: `lead` | `member` | `left`), all 11 existing rows = `lead`.
- `affiliates`: public SELECT policy GONE. Public access ONLY via `public_affiliates` view (columns: name, ref_id).
- `nurture_queue`, `member_profile`, `site_settings`: RLS ON, zero public policies (service role only).
- `site_settings` rows: `member_discount_code = WHSBGN`, `member_discount_pct = 20`. **Rotation procedure: Ignacio updates the code in baknd AND updates this one row. Pages pick it up automatically.**
- All rows previously `source = 'Main Quiz'` are now `source = 'quiz'`. Row count unchanged (11).

### RULES FOR ANTIGRAVITY GOING FORWARD
- NEVER add a public SELECT policy back to approved_members or affiliates.
- NEVER read approved_members from page JavaScript. Pages go through edge functions only.
- Affiliate name lookups from pages use `rest/v1/public_affiliates?select=name&ref_id=eq.<ref>` with the anon key.
- All member gating uses `member_status`, NOT `active` (active defaults true for quiz leads and means nothing about community membership).

---

## 2. SUPABASE | EDGE FUNCTIONS

### NEW: `get-member-code` (v1, verify_jwt false)
The ONLY channel that delivers the member discount code to a browser.
- Request: `POST { email }`
- Behavior: rate-limited (10/10min per email). Looks up approved_members by lowercase email WHERE `member_status = 'member'`. If matched, reads site_settings keys `member_discount_code` + `member_discount_pct`.
- Response (member): `{ verified: true, code: "WHSBGN", discount: "20%" }`
- Response (lead/unknown): `{ verified: false }`
- NEVER cache or hardcode the code in any page. Always fetch at runtime after a verified gate.

### UPDATED: `verify-member` (v15 → v16)
- Response now includes `member_status` (`'lead'` fallback). Everything else unchanged. Existing callers unaffected (additive field).
- Use this on gated pages to branch: `member` → full access · `lead` → "join first" locked state → Skool CTA · unverified → generic locked state.

### UPDATED: `add-member` (v25 → v27)
1. **Source normalization:** `source = (body.source || 'quiz').toLowerCase()`. `isQuizSource = source.includes('quiz')`. So `quiz`, `Main Quiz`, `standalone-quiz` all count as quiz completions. Stored value is the lowercased string.
2. **Nurture branching now uses isQuizSource:** quiz-flavored source + archetype → trigger-nurture-sequence. Any non-quiz source → cancel-nurture-sequence. (Previously only the exact string `quiz` triggered; `Main Quiz` was cancelling its own nurture. Fixed.)
3. **member_status flip:** non-quiz source (Skool join via Pabbly, manual) sets `member_status = 'member'` in the upsert. Quiz-flavored sources DO NOT touch member_status (new rows default to `lead`; an existing member retaking the quiz is not downgraded).
4. **Validation widened:** `price` now also accepts the literal `free`. `price_interval` now also accepts `community` (allowed set: monthly, one-time, community). The homepage/quiz payload `price:'free', price_interval:'community'` now stores instead of nulling.
5. **Products are commission-free:** referral records created/updated by this function now write `commission_amount: null`, and the ambassador update increments `total_conversions` only (no `total_earned` accrual). Affiliate money lives on the Skool paid tier only.
6. **CRM sync adjustments:** first tag is `Quiz Completed` or `Community Member` depending on source; added `member_status` property; price tag handles `free`. Hardcoded BAKND_API_KEY fallback is STILL PRESENT with a TODO: once Ignacio sets the `BAKND_API_KEY` secret in Supabase, remove the fallback and redeploy.

### PAYLOAD CONTRACT (quiz pages → add-member)
`source` MUST be exactly `'quiz'` from now on (normalization is a safety net, not permission). `price:'free'`, `price_interval:'community'` are the standard for quiz completions.

---

## 3. PAGE: whealthy-home.html

Two changes only. Everything else (12-screen quiz engine, P1_QD, QD, SM, BUNDLE_MAP, RDS, identity waterfall, cost table, dual-path result, tracking) untouched and verified byte-identical.

1. **`joinStewards()` body replaced.** Was: redirect to `https://whealthylabel.com/invite`. Now:
```js
function joinStewards(){
  if(window._wTrack) window._wTrack('cta_click',{label:'Join the Community',location:'result',is_result:true});
  window.open(getSkoolJoinUrl(),'_blank','noopener');
}
```
All 5 result-page join CTAs now go STRAIGHT to the Skool about page with `?ref=` pass-through (no fallback ref). The invite page remains for affiliate shares only.
2. **BUNDLE_CONFIG checkout URLs upgraded http → https** (all 4 bundles, `https://whealthylabel.com/new/...`).

---

## 4. PAGE: whealthy-quiz.html

1. **Payload source fixed:** `source:'standalone-quiz'` → `source:'quiz'` (this page was creating the mis-sourced rows).
2. **NEW block after `joinStewards()` (~line 404): direct purchase path.**
```js
const BUNDLE_CONFIG={
  'genius-joe':{name:'The Genius Joe Routine',checkoutUrl:'https://whealthylabel.com/new/genius-joe-functional-coffee-hydration-bundle'},
  'boss':{name:'The Boss Routine',checkoutUrl:'https://whealthylabel.com/new/boss-performance-capsules-hydration-bundle'},
  'genius-guice':{name:'The Genius Guice Routine',checkoutUrl:'https://whealthylabel.com/new/genius-guice-think-drink-powder-hydration-bundle'},
  'charge':{name:'The Charge Routine',checkoutUrl:'https://whealthylabel.com/new/charge-powder-hydration'}
};
window._lastBundleKey=null;
function buyBundleCurrent(){
  var cfg=BUNDLE_CONFIG[window._lastBundleKey];
  if(!cfg)return;
  if(window._wTrack)window._wTrack('purchase_checkout',{bundle:window._lastBundleKey,location:'quiz-result'});
  window.open(cfg.checkoutUrl,'_blank','noopener');
}
```
3. **`showFullResult(result,bundleKey)` now sets `window._lastBundleKey=bundleKey;`** as its first line.
4. **Dual-path result:** under the main "Join the Community. Free." CTA block, added an "or" divider + outline button `Start Your Routine Now · Full Price` (calls `buyBundleCurrent()`) + note "No account. No community. <Routine name> ships, you start. U.S. shipping only."
5. **Final CTA block:** added text button `Or buy <Routine name> now at full price` (calls `buyBundleCurrent()`) above the retake button.
6. NOT done on this page (deliberate, deferred): the 12-screen engine port (Part 1 Weight questions, RDS, identity profiles, cost table). This page still runs the 5-question engine. Scheduled as its own follow-up build. SM/QD arrays remain identical to doctrine.
7. **FLAGGED, awaiting Ignacio's decision, DO NOT replicate:** the result page `PROOF_MAP` testimonials (Marcus T., Chris M., Daniel R., Pastor Jerome W., Kevin W.). If not real people/quotes, they violate the no-fabricated-social-proof rule and must be removed. Do not copy this pattern to any other page.

---

## 5. PAGE: whealthy-join.html (full copy rewrite: free community invitation)

Design/structure/CSS untouched. Copy changes:

1. **"What's Inside" section:** label "One Membership. One Price." → "The Stewards Community". Title "Everything That Ships With You" → "Everything That Stands With You". Sub now: free to join, 20% off every governance routine.
2. **Price card:** `$79/mo` amount → `Free to join`. Label "Cancel anytime" → "Leave anytime".
3. **Includes list (all 5 rewritten):** 01 A Room of Real Stewards (community) · 02 Prayer, Fasting, and the Word (member dashboard: pray, scripture-rooted fast builder, 365-day Bible study) · 03 The Stewardship Mirror (quiz) · 04 Monthly 30-Day Challenges · 05 20% Off Every Product. (Old items about the monthly included bundle, auto-ship/claim, and founding affiliate 40% are REMOVED. Affiliate economics return with the paid tier.)
4. **Price CTA:** "Join The Stewards - $79/mo" → "Join The Stewards · Free". Note now says the dashboard + 20% code unlock inside.
5. **Bundles section:** label "Included Every Month" → "Members Get 20% Off". Sub reframed: available to everyone, members never pay full price. Footer line: "Every routine includes hydration. Members save 20% on all of them."
6. **Steps:** step 1 "joining takes less than a minute, free" (was $79/mo). Step 3: start your routine with the 20% member code (was bundle-ships-included).
7. **Community section label:** "Part of Your Membership" → "Why Stewards Stay". "The bundle is the system" → "The routine is the system".
8. **Final CTA:** sub reframed to free community + 20%. Secondary button → "Join The Stewards · Free". Chips → Free to Join / 20% Off Products / Faith · Family · Focus.
9. **Pillars sub:** removed the sentence using the word "supplement" (Language Constitution).
10. Verified: zero `$79`, zero `supplement` on the page. Skool join with ref pass-through unchanged.

---

## 6. PAGE: whealthy-dashboard.html

1. **Discount banner rebuilt (id `memberDiscountBanner`):** hidden by default (`display:none`), NO hardcoded code. Title "Your Member Discount" (badge-check icon, was alert-triangle). Text "20% off every product, every time. Yours as long as you're a Steward." Code span id `memberDiscountCode` renders bullet placeholders until fetched. (Old version: hardcoded WHSBGN, "additional 10% OFF", "Code expires soon!" fake urgency. All removed.)
2. **NEW `loadMemberDiscount(email)`:** POSTs to `FN + '/get-member-code'`. On `{verified:true, code}` populates the code + discount text and shows the banner. Otherwise the banner stays hidden. Called from the gate success path, right after `localStorage.setItem('wh_steward_email', email)`.
3. **`copyDiscountCode()` rewritten:** copies the live text of `#memberDiscountCode` (both clipboard API and fallback path). Refuses to copy while the placeholder is showing. No literal code string anywhere in the file.
4. **Product-hub intro card copy replaced:** heading "The Insider's Unfair Advantage" → "Member Pricing, Every Time"; removed "play by different rules / practically bribe you / peak-performance stack / arsenal / before your code expires" hype (brand voice violations). New copy: member pricing active, code takes 20% off, yours as long as you're a Steward.
5. **All 5 per-product CTA lines:** "Use code WHSBGN at checkout for an extra 10% off" → "Use your member code (in your discount card above) at checkout for 20% off".
6. Verified: zero occurrences of WHSBGN or "10% off" in the file. All other dashboard features (prayer, leaderboard, affiliate links, onboarding) untouched.
7. NOTE: the gate still uses `get-subscription`'s verified flag. Until Pabbly flips real members to `member_status='member'`, get-member-code returns `verified:false` for everyone and the banner simply stays hidden. That is correct behavior, not a bug.

---

## 7. NOT CHANGED (do not "fix" these)

- whealthy-command-center.html: untouched by this session.
- whealthy-invite.html: untouched (already points at public_affiliates; still carries a founding-affiliate P.S. flagged for later).
- SM scoring matrix, QD questions/options, archetype keys, bundle keys: byte-identical everywhere.
- bundle_subscriptions / bundle_orders / try_orders and their edge functions: untouched.
- All tracking events (_wTrack) preserved; quiz result added one new event: `purchase_checkout` with `location:'quiz-result'`.

## 8. OPEN ITEMS (owner: Ignacio unless noted)

1. Re-paste the 4 updated pages into baknd (home, quiz, join, dashboard). Local files do not deploy themselves.
2. Pabbly Skool-join workflow: call add-member with `source:'skool'` (plus email + name). This is what flips lead → member and unlocks the code.
3. Set `BAKND_API_KEY` secret in Supabase, then remove the hardcoded fallback in add-member and redeploy (Claude/Antigravity).
4. Decide on quiz PROOF_MAP testimonials (remove if not real).
5. whealthy-quiz-demo.html still queries the old `affiliates` REST path; its badge now silently fails. Patch or retire.
6. Bundle full prices, baknd subscription checkout URLs (members 20%), paid tier price/name: still TBD, blocks WO-5/6/7 finishing work.
7. Flip any real member emails to `member_status='member'` manually until Pabbly is wired (one-line SQL per email, service role).

*End of changelog. Version of record for the July 13, 2026 session.*

---

# SESSION 2 ADDENDUM | Same day, later | Folder-wide old-model purge

## 9. PAGE: whealthy-dashboard.html (second pass)
1. Affiliate share pitches: removed "Sells the $79/mo membership directly. Converts at 4.2%" (dead offer + fabricated stat) and "upsells to membership". Now invite-the-free-community framing.
2. Sidebar button: "Claim Your Bundle / Manage Bundle" -> "Start My Routine / Manage My Routine".
3. Value stack: "Your Stewards Membership Covers This / $9.95 shipping / Covered by your monthly membership ($79/mo)" -> "Your Member Pricing / 20% off, every time / Members never pay full price. Use your member code at checkout."
4. Primary CTA: "Claim My {bundle} Bundle" -> "Start My {bundle} Routine". Note line "Included with membership ($79/mo) + $9.95 Shipping" -> "Member pricing. Your 20% code applies at checkout."
5. Skool invite card: label "Part of Your Membership" -> "The Stewards Community"; desc rewritten to free-to-join + 20% member benefit.
6. Final CTA: sub + button rewritten ("Start My {bundle} Routine - 20% Off for Members").
7. Claimed banner: "Bundle Has Been Claimed / included with your Stewards membership / ships automatically" -> "Routine Is Active / manage your routine, shipping, and next order here." Info box reframed to member pricing.
8. Referral block: removed "Just 3 active referrals gets your membership paid for!" and "Refer 3, Get it Free" (income-claim + free-membership math that no longer exists). Affiliate copy now: founding affiliates earn 40% recurring on PAID memberships through Skool, lifetime attribution, rate only.
9. NOTE: the claim() function was verified to already open a real baknd checkout with email prefill. Flow unchanged; only the copy lied about the old model.

## 10. PAGES: whealthy-try-boss / try-charge / try-genius-guice / try-genius-joe / try-hydration
Shared template, all 5 patched identically:
1. Comparison "Full System" card: price "$79/mo + $9.95 S&H Monthly" -> "Free to join / Members get 20% off every product (US shipping)". Product line -> "Your Matched Routine + Stewards Community". Feature "2 products monthly (X + matched)" -> "Your matched routine, 20% off for members". Feature "Founding affiliate access (40%)" -> "Prayer, fasting, and Bible study tools".
2. Left (try-product) card dashes: "No matched governance product" -> "Full price, no member discount"; "No affiliate program" -> "No member pricing".
3. FAQ: "What is the Stewards Membership?" -> "What is the Stewards Community?" with the answer rewritten to free-to-join + what's inside + 20% member benefit. "Find Your Match" quiz link kept.
4. REMOVED dead-code fake urgency machinery (all 6 try pages incl. try-all): a 15-minute countdown that reset on every open, and a fabricated social-proof ticker ("Marcus T. from Dallas ordered 2 hours ago", "93% of buyers re-order within 30 days"). It was never called and had no elements, but the fabricated content is banned; deleted so it can never be wired up. Replaced with a one-line comment marking it removed for compliance.

## 11. PAGE: whealthy-try-all.html
1. All 7 http://whealthylabel links -> https.
2. Same fake-urgency dead code removed (see 10.4).

## 12. PAGE: whealthy-command-center.html (member app)
1. Affiliate share pitch: "Sells the $79/mo membership directly" -> free community invite framing.
2. Voice line: "Taking you to claim your bundle" -> "Taking you to start your routine."

## 13. FOLDER STATE AFTER SESSION 2
- $79 / old-offer copy remains ONLY in: whealthy-claim-bundle.html (awaiting its full WO-6 manage-portal rebuild; dashboard buttons still route to it) and whealthy-quiz-demo.html (recommended: retire).
- All try pages, dashboard, command-center, home, quiz, join, invite: verified clean of old-model pricing, fabricated stats, fake urgency. All JS syntax-checked.
- Backups of every pre-edit file are preserved (12 files + approved_members JSON export).
- Still open: PROOF_MAP testimonials on whealthy-quiz.html (Ignacio to confirm real or remove), BAKND_API_KEY secret, Pabbly source:'skool', re-paste all updated pages into baknd, WO-6 claim-portal rebuild, quiz-demo retirement.

*End of Session 2 addendum.*

---

# SESSION 3 ADDENDUM | Standalone quiz full parity port

## 14. PAGE: whealthy-quiz.html (REPLACED WHOLESALE)
The old 5-question standalone quiz is retired (backup kept: whealthy-quiz-5q-version.html in session backups). The page is now a full clone of whealthy-home.html with standalone behavior:
1. IDENTICAL quiz to the homepage: 12 screens (7 Weight + 5 Pattern), P1_QD, QD, SM, BUNDLE_MAP + secondary routing, RDS + load season, 6 Identity Profiles, consumption cost table, reveal beat, full S0-S9 result with the S7 dual-path decision block (buy via purchase popup / join Skool direct with ref), contact form, add-member payload with source:'quiz' and all Part 1 flat fields. Parity verified token-by-token against the homepage.
2. Standalone behavior added at end of body: (a) CSS hides every body child except the quiz modal; (b) quiz auto-opens on page load; (c) closeQuiz() is wrapped so closing the quiz sends the visitor to whealthylabel.com (drop-off tracking still fires first).
3. Head: title/OG rewritten for the quiz page ("Find What's Draining You"), og:url /steward-quiz. Old-model OG description removed.
4. SIDE EFFECT (intentional): the old page's PROOF_MAP fabricated testimonials no longer exist on this page.
5. Tracking: _wTrack logs page from window.location.pathname, so events auto- segment by the /steward-quiz path. No analytics changes needed.

## 15. PAGE: whealthy-home.html (meta touch-up)
1. Removed `user-scalable=no` from the viewport tag (accessibility violation; also removed on the quiz clone).
2. og:description updated from the old "One membership. Your system delivered every month." to freemium copy (free community, pattern quiz, 20% member benefit).

## 16. whealthy-quiz.html standalone layer v2 (baknd-proof fix)
First deploy showed the homepage hero instead of the quiz. Cause: baknd wraps embeds in its own containers, so the body-child hiding selector missed, and the DOMContentLoaded auto-open never fired (embed scripts can run after load). Fix, verified in a simulated browser (auto-opens to THE WEIGHT Q1):
1. Hiding now targets named surfaces at any nesting depth: .scroll-progress, .announcement-bar, #inviteBanner, #whealthy-app-embed, all 11 homepage sections by class, .section-divider, .sticky-cta, footer.
2. Auto-open is readyState-aware with a 200ms retry loop (max 8s) until #quizModal + openQuiz exist.
3. closeQuiz wrapper waits for the function to exist before wrapping; closing still exits to whealthylabel.com after drop-off tracking.
4. Removed a display:block override that would have broken the modal's flex centering.
RULE: standalone-page behavior layers must never rely on body>* structure; baknd wrappers break structural selectors.

---

# SESSION 4 ADDENDUM | Mic + AI wiring audit and governor-ai v2

## 17. AUDIT RESULT: Command Center voice + AI pipeline
Verified working: mic capture (getUserMedia + AudioContext waveform, 3 surfaces), SpeechRecognition transcript, ask() -> governor-ai contract (no keys in page), governor-state live and healthy in logs (member validation + 8:45 PM gate server-side), scripture from fixed library only, client fallbacks on every AI call site.

## 18. EDGE FUNCTION: governor-ai (v1 -> v2)
1. FIXED: added missing tasks to MAX_TOKENS: intent_router (300) and profile_update (500). The page calls both; v1 rejected them with unknown_task, so the voice command layer and the learning profile NEVER worked server-side.
2. FIXED: model string "claude-sonnet-4-6" replaced with "claude-sonnet-5" (valid current model; the old string could not be verified as a real model and the function had zero successful invocations ever).
3. ADDED: per-email rate limiting (30 calls / 10 min) matching the house pattern.
4. ADDED: Anthropic API error logging + retry (v1 silently parsed error bodies).
5. NOTE in code: member validation still allows any approved_members row (leads) so the app works pre-launch; tighten to member_status='member' once Pabbly flips real joins.
6. STILL UNVERIFIED until first live call: the ANTHROPIC_API_KEY secret must exist in Supabase Edge Function secrets. First real entry filed from the dashboard proves it; check governor-ai logs after.

## 19. NOTED: add-member v30 (deployed outside this session)
Antigravity/local redeployed add-member after v27 (v28/29 had boot 503s; v30 healthy). v30 PRESERVES all freemium logic and adds merge-with-existing to prevent field overwrites. BAKND_API_KEY is now required with no fallback: CRM contact sync silently fails (logged) until the secret is set in Supabase.

---

# SESSION 5 ADDENDUM | baknd-webhook freemium rewrite (v12)

## 20. EDGE FUNCTION: baknd-webhook (old-model v9 -> freemium v12)
Deployed live AND synced to local source (supabase/functions/baknd-webhook/index.ts).
1. REMOVED membership rejection. Old version 403'd any buyer not in approved_members and any inactive member, meaning paid non-member orders were never sent to Shopify/Supliful. Now ANY paid bundle order is fulfilled. Member status is looked up for tagging only (Member/Non-Member Shopify tag).
2. Duplicate protection rescoped: was "same email blocked for 25 days" (broke legit repeat purchases); now same email + same bundle within 15 minutes (catches double-fired webhooks only).
3. Subscription detection added (order/item subscription/recurring flags + billing interval keys + item title heuristics). bundle_subscriptions rows with auto_order:true are ONLY created for subscription orders; one-time buyers get a bundle_orders record only. bundle_orders.source distinguishes native_checkout vs native_checkout_subscription.
4. Shopify push UNCHANGED: same variant IDs, $0.00 line items (payment captured by baknd), financial_status paid. Tags now include Subscription/One-Time and Member/Non-Member.
5. Webhook secret validation unchanged (BAKND_WEBHOOK_SECRET, query param or header).
6. VERIFY ON FIRST REAL ORDER: baknd's actual payload shape for subscriptions must be confirmed against the detection heuristics in 3b. Check the function log line "Order type:" on the first subscription purchase; if it says one-time, capture the payload and adjust the detection flags.

## 21. SECRETS STATE (per Ignacio)
- ANTHROPIC_API_KEY: set (named correctly per instruction). BAKND_API_KEY: set. BAKND_WEBHOOK_SECRET: pre-existing (webhook auth, different credential from the CRM key). RESEND_API_KEY: confirmed working via nurture logs. SHOPIFY_STORE / SHOPIFY_ACCESS_TOKEN: referenced by baknd-webhook, presumed set from prior work.
- Repo verified clean of hardcoded keys; test_baknd.ts rewritten to read BAKND_API_KEY from env.
- Anthropic key was shared in chat: rotate after first successful governor-ai test.

## 22. whealthy-dashboard.html: boot loader + whealthy-command-center.html: logout fix
1. DASHBOARD BOOT LOADER: new self-contained #bootLoader as the first element inside the embed (own inline styles, hardcoded colors, no var()/font/script dependencies) so it paints immediately inside baknd's wrapper. Full-screen matte black, lime spinner ring, pulsing wordmark, cycling status text, prefers-reduced-motion support, 12s safety auto-hide. hideBootLoader() wired into all 5 resolution points (gate shown, unverified, verified, error paths). Verified in simulated browser across all three boot paths. Root cause of "no loading animation": old spinner depended on main-stylesheet CSS variables and baknd embed timing.
2. COMMAND CENTER LOGOUT: handleLogout existed but opened with confirm(), which browsers silently block inside cross-origin iframes (baknd embeds) -> button did nothing. Rewritten as two-tap pattern (first tap arms "Tap again to log out", 4s window), clears wh_steward_email/ref_id/drafts/bible state, signs out Supabase auth session, reloads to the gate. Verified in simulated browser.
3. KNOWN SAME-CLASS BUG (flagged, not yet fixed): three other confirm() calls will no-op in baknd embeds: Bible progress reset, keep-readings prompt, and Record entry burn.

## 23. whealthy-command-center.html: boot loader + storage hardening
1. Same self-contained #bootLoader as the dashboard (first element in body, inline styles, no dependencies): covers the governor-state load wait after the gate. Lifecycle: no session -> gate shows, loader clears; session -> loader visible until renderDash() completes; load() failure or 12s -> loader clears regardless.
2. All 24 direct localStorage calls routed through crash-proof helpers (__lsGet/__lsSet/__lsDel defined in the loader script, which runs first). Sandboxed embeds that block storage can no longer kill any script block.
3. Verified in simulated browser: gate path, loading path, loaded path.

## 24. Bible 365 dead buttons + login gate z-index (command center + dashboard)
1. ROOT CAUSE 1: supabase-js CDN script had `defer`, but the Bible module is an inline script that runs during parse -> "supabase is not defined" killed the whole block in every real browser -> initBible365 never existed -> ALL Bible buttons dead. FIX: defer removed (library loads before inline scripts) + null-safe client (`sb=null` if CDN absent, guards switched from `typeof sb!=='undefined'` to truthy so null cannot pass). Applied to BOTH whealthy-command-center.html and whealthy-dashboard.html.
2. ROOT CAUSE 2 (command center): updateScrollGate() dereferenced #bible_scrollGateHint which no longer exists in the markup -> every renderHero crashed. Now fully null-safe. (Dashboard still has the element; unaffected.)
3. LOGIN GATE CSS: baknd's footer stack rendered above the gate (gate z-index 9999). Gate now 2147483000, boot loaders 2147483600, on top of anything baknd renders. Dashboard boot loader same.
4. Verified via simulated browser on #bible: module inits, Read Passage opens/closes, checkmark clickable, prev/next respond (next correctly capped at today's unlocked day).

## 25. Floating mic restored as the Governor (voice command layer)
1. Architecture note: the full voice command layer already exists in whealthy-command-center.html (intent_router prompt with complete intent catalog, GUARDED set requiring confirmation for burn/fast_start/fast_end/claim/invite, dispatchIntent covering nav_go, daily_briefing, scripture reads, fast controls, record queries, speak-back TTS, background profile learning).
2. WHY IT ACTED LIKE A JOURNAL MIC: (a) governor-ai v1 rejected intent_router as unknown_task -> the code's failure fallback files a journal entry -> every floating-mic capture became a journal entry on the live site. Fixed by governor-ai v2 (task added). (b) A record-view override forced journal_entry for ALL mic modes whenever the record view was open. Now scoped to mode==='record' only: the record page mic journals, the floating ('sheet') and dashboard ('dash') mics keep their routed intent everywhere.
3. Pending live proof: ANTHROPIC_API_KEY secret named exactly that in Supabase, then a spoken command ("take me to the fast" / "give me my briefing") should navigate and speak back.

## 26. Floating mic sheet rebuilt as the Governor surface (command center)
1. openCaptureSheet: opens CLEAN (no journal-draft import), Governor framing ("Speak it. Navigate, pull the record, check the fast, or file tonight's entry"), no journal prompt.
2. closeCaptureSheet: closing = cancel. No auto-execute, and the sheet text is NO LONGER exported into the record page journal draft (previously spoken commands leaked into the journal box).
3. stopMic(autoExec=true): when the SHEET mic stops (tap or silence), the Governor auto-executes the routed intent ("On it..." state, 250ms). Record-page mic unchanged. closeCaptureSheet calls stopMic(false).
4. After dispatch in sheet mode: the state line displays the executed action (intent.speak_back), and nav_go / daily_briefing auto-close the sheet so the result is visible.
5. Button label "File Tonight's Entry" -> "Execute" (manual fallback for edited text).
6. Verified in simulated browser: clean open -> "take me to the fast" -> routed nav_go -> feedback shown -> fast view opened -> sheet closed -> journal draft untouched.

## 27. Governor sheet -> compact corner panel (command center)
1. New override style block "GOVERNOR CORNER MODE": the capture sheet is now a ~360px card anchored bottom-right above the floating mic (mobile: full-width-minus-margins), lime-edged glass card, spring pop-in. No full-screen dim, no backdrop blur.
2. The overlay no longer captures clicks (pointer-events none; panel itself interactive) and openCaptureSheet no longer locks body scroll: the page stays fully visible, scrollable, and clickable while the Governor listens and executes.
3. Compact internals: smaller prompt, scaled-down mic, capped transcript height, drag handle hidden. Close via X; nav_go/daily_briefing still auto-close after execution.
4. Verified in simulated browser: page unlocked while open, overlay click-passthrough, corner position (right 16 / bottom 96), full command flow still executes (nav_go -> fast view opens, feedback shown).
