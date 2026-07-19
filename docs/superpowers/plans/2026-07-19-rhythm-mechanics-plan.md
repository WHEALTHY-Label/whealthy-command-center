# WHEALTHY | THE DISCIPLINES | RHYTHM MECHANICS PLAN v4
### The Page Program | July 19, 2026 | Supersedes v1, v2, v3 of the same day

> **What changed in v4.** The plan is restructured into PAGES, the same method the prayer pillar was built with: one page at a time, Antigravity builds, reports in the required format, the report is cross-verified, and only then does the next page unlock. The Phase 0 push script now lives in this document verbatim. Every page carries its exact spec, the report template, and the verification commands with expected outputs, so nothing gets accepted on trust.

> **Antigravity: the one rule above all.** Build exactly one page, then STOP and produce the Page Report. Do not begin the next page until the report has been verified in chat and the go is given. Never mark an item done that a check did not pass. Where this plan and older context docs disagree, this plan wins.

---

## THE BUILD METHOD

**The loop, per page:** brief (this doc) → build → PAGE REPORT → cross-verification → go/fix → next page.

**The Page Report template (required, every page):**
```
PAGE N REPORT
Files changed:        [path: one line on what changed]
Functions deployed:   [name, new version number from supabase]
Migrations applied:   [name(s)]
Tests run:            [command or script, PASS/FAIL each]
Screenshots attached: [filename per required width/state]
Not done / blocked:   [anything, or "nothing"]
```

**Who verifies what.** Claude cross-verifies backend in band (SQL against the live project, pg_net calls to functions, expected outputs below). Ignacio can paste any VERIFY block into the Supabase SQL editor and compare against the expected result himself. UI pages verify by the required screenshots at 360, 400, and 430 wide plus the checks listed.

**QA fixtures.** Backend verification uses dedicated test members with emails `qa-steward-1@whealthylabel.com` and `qa-steward-2@whealthylabel.com`, `source = 'qa-test'`. They are created during Page 1 verification and every fixture row is deleted at program end. No real member row is ever written by tests.

---

## THE DISCIPLINES FRAME (governing concepts, unchanged from v3)

**The four disciplines**, canonical key `discipline in ('word','prayer','fast','record')`:

| Discipline | Member name | Practice space | Live signal |
|---|---|---|---|
| Scripture | **The Word** | Bible 365 + reflections | `bible_progress.completed_days`, `bible_reflections` |
| Prayer | **Prayer** | The Wall, prayers, watchlist | `wall_prays`, `prayers`, `member_prayer_state` |
| Fasting | **The Fast** | Fast builder + 8:45 PM report | governor-state fast day reports, `fasts`, `fast_history` |
| Journaling | **The Record** | Voice-first Record | `record_entries` |

**Cornerstone verses** (BSB, from `bible_verses`): 1 Timothy 4:7-8 ("Train yourself for godliness...") and Hebrews 12:11 ("No discipline seems enjoyable at the time...").

**Tab architecture** (ships Page 7 at the latest): THE WORD, PRAYER, THE FAST, THE RECORD, plus Me.

**Lingo pack** (fixed strings): "Today's disciplines" · "Three of four disciplines kept today" · "The rhythm held." · "Mercy covered Tuesday." · "Pick it back up. His mercies are new in the morning." · "The Record has been quiet four days. Want to speak tonight's entry?" · Governor greeting: "Which discipline are we keeping first?"

**Standing rules, every page:** pages call functions, functions hold the service role, no keys in pages · new tables RLS ON with zero public policies · scripture verbatim from `bible_verses`, never AI generated · Language Constitution on every string, no em dashes, never "broken", vocabulary is kept, held, covered, quiet, pick it back up · two-tap confirms, no confirm() dialogs · mobile first, 44px targets, no red · privacy floor: checkmarks and first names only, never content, never emails, never miss counts · member copy says "discipline", never "features".

---

# PAGE 0 | THE PUSH (owner: Antigravity or Ignacio, from the machine)

Production is running quiz v1, the four-field gate, the $60 figure, bible-api.com in four pages, and the robot voice. Everything already fixed is uncommitted. Nothing else in this program ships first.

**The script, verbatim, from the repo folder** (`.../WHEALTHY STEWARDS/whealthy-command-center-repo`):
```bash
rm -f .git/index.lock
git add -A
git commit -m "feat: owned Bible layer, bible-verses replaces bible-api.com across all pages, plus quiz v2 gate and cost updates"
git checkout main
git merge feature/quiz-v2-display
git push origin main
```
Notes: two stale `index.lock` files from the cloud session were already moved to `../_to_delete/`, delete that folder whenever. The merge is a fast forward, the branch is exactly one commit ahead of main with nothing on main missing from it (verified July 19). The push to main triggers the Vercel production deploy automatically.

**VERIFY, after the deploy shows READY:**
```bash
# from the repo folder: the deployed sha must equal local main
git log -1 --format=%H main
```
Compare to the sha shown on the newest production deployment in Vercel. Then, live-content checks against main:
```bash
git show main:whealthy-quiz.html | grep -c "TOTAL_SCREENS = 11"     # expect 1
git show main:whealthy-quiz.html | grep -c "captLastName"           # expect 0
git show main:whealthy-quiz.html | grep -c "lo:120,hi:150"          # expect 1
for f in index.html whealthy-bible-365.html whealthy-command-center.html whealthy-dashboard.html; do
  git show main:$f | grep -c "bible-api.com"; done                  # expect 0 0 0 0
```
In the browser on the production URL: take the quiz to screen 3 (the double screen renders), open Bible 365 (verses load, network tab shows only `/functions/v1/bible-verses`).

**GATE:** all counts match, one manual browser pass clean. Then Page 1.

---

# PAGE 1 | THE DISCIPLINE LEDGER, `discipline-day` (owner: Claude backend)

One read-only edge function. No schema changes. Everything downstream consumes it.

**Contract.** POST `{ "email": "...", "from": "2026-07-01", "to": "2026-07-19" }` →
```json
{
  "days": [
    { "date": "2026-07-01", "word": true, "prayer": false, "fast": null, "record": true }
  ],
  "today": { "date": "2026-07-19", "word": false, "prayer": false, "fast": null, "record": false },
  "last_active": { "word": "2026-07-18", "prayer": "2026-07-15", "fast": null, "record": "2026-07-18" },
  "chains": { "built on Page 2": true }
}
```
Range cap 92 days. Unknown email returns empty `days`, HTTP 200. Errors return `{ "error": "..." }`, never a stack.

**Signal rules.**
- word: day index present in `bible_progress.completed_days` relative to `start_date`, keyed by email.
- prayer: any `wall_prays` row that day by the member (join through `approved_members.id`), or a `prayers` row authored that day. Decision 9 SETTLED: prayer counts, as intercession only. The signal, the chain, and the circle mark are all live.
- fast: the governor-state fast day report for the active fast; no active fast = `null`, never `false`. Exact storage shape confirmed at build by reading governor-state source, read only.
- record: `record_entries` row with `entry_date` = day, member email match, `burned = false`.

**Report:** template above, plus the discovered fast-report storage shape written down in one sentence.

**VERIFY (Claude runs in band; Ignacio can run the SQL half in the SQL editor):**
1. Seed fixtures: qa-steward-1 with a `bible_progress` row (start July 1, days 1, 2, 3 completed), one `record_entries` row July 2, one `wall_prays` row July 2.
2. Call `discipline-day` for July 1 to 3 via pg_net. Expect: July 1 word true, others false or null. July 2 word true, prayer true, record true. July 3 word true only.
3. Unknown email `nobody@example.com` → `days: []`, HTTP 200.
4. Confirm zero writes: row counts of all source tables identical before and after the calls, except the seeded fixtures.

**GATE:** all four checks pass. Then Page 2.

---

# PAGE 2 | THE CHAIN, WITH GRACE (owners: Claude backend, then Antigravity UI)

**Backend half.** Extend `discipline-day` with `chains`:
```json
"chains": {
  "word":   { "current": 12, "longest": 21, "graced_days": ["2026-07-15"] },
  "prayer": { "current": 3,  "longest": 9,  "graced_days": [] },
  "fast":   { "current": 0,  "longest": 14, "graced_days": [] },
  "record": { "current": 5,  "longest": 5,  "graced_days": [] },
  "rhythm": { "current": 12, "longest": 30, "graced_days": [] }
}
```
Rules: a rhythm day = at least one discipline kept (Decision 1). Grace = one missed day per calendar week (Monday start) per discipline is covered, flagged in `graced_days`, chain holds (Decision 2). Second miss in the same week restarts the chain quietly. **Streak carry-over:** the member's live `bible_progress.streak` value seeds the word chain's starting count so nobody wakes up to a reset; `bible_progress.streak` itself is never written.

**UI half (Antigravity).** A chain chip on The Word header (Bible 365), The Fast page, and the dashboard card. Contents: count plus state line from the lingo pack only: "The rhythm held." / "Mercy covered {day}." / "Pick it back up. His mercies are new in the morning." with Lamentations 3:22-23 fetched from `bible-verses`. A seven-dot week row, kept = filled, graced = dashed outline with G, missed = dim. No flames, no fire emoji, no red anywhere.

**Report:** template, plus the three chip locations as file line references.

**VERIFY:**
1. Backend, with qa-steward-1 fixtures shaped to three histories: perfect week → current increments daily, `graced_days` empty. One miss Wednesday → chain holds, `graced_days` contains that date. Misses Tuesday and Thursday same week → chain equals days since Thursday, copy state = reset. Claude runs all three in band and posts the JSON.
2. Carry-over: set fixture `bible_progress.streak = 40`, first `discipline-day` call shows word chain current ≥ 40.
3. UI: screenshots at 360, 400, 430 of all three chip locations in all three states (nine screenshots), zero red pixels, strings byte-identical to the lingo pack.

**GATE:** backend JSON matches expectations, screenshots pass. Then Page 3.

---

# PAGE 3 | THE COHORT CHALLENGE (owners: Claude backend, then Antigravity UI)

**Migration `create_challenge_cohorts`:**
```sql
CREATE TABLE challenge_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
ALTER TABLE challenge_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fasts ADD COLUMN IF NOT EXISTS cohort_id uuid;  -- the only existing-table touch in this program
```

**Functions.**
- `cohort-join`: POST `{ email, cohort_id }` → stamps the member's ACTIVE fast row with the cohort; error if no active fast; error if cohort status is not open. Page confirms with two-tap.
- `cohort-board`: POST `{ cohort_id }` → `{ "cohort": "The August Fast", "day": 12, "of": 30, "members": [ { "name": "Sarah K", "days_kept": 12 } ] }`, days kept from `discipline-day`, first name plus last initial only, ordered days kept then join date.

**Wall tie.** On completion the page OFFERS a testimony post via the existing `wall-post` with `source: 'challenge'`. Member-initiated only, never auto-posted (Decision 3).

**UI.** Group board inside The Fast when the member's fast has a cohort: the rows, "You" highlighted in lime, the day counter, and at completion the single offer button with the note "Only if you want to. The app never posts for you."

**Report:** template, plus the migration name as applied.

**VERIFY:**
1. Both qa stewards join a qa cohort; board returns both, ordered correctly, no emails anywhere in the response body (Claude greps the raw JSON).
2. `cohort-join` with no active fast → error JSON, no write.
3. Completion writes nothing to `wall_posts` without the member action: `select count(*) from wall_posts where source='challenge'` unchanged after board calls.
4. UI screenshots at three widths, plus the completion state.

**GATE:** pass, then Page 4.

---

# PAGE 4 | THE WORD THAT ARRIVES (owners: Claude backend, then Antigravity UI)

**Migration `create_word_bank_and_deliveries`:**
```sql
CREATE TABLE word_bank (
  id bigint generated always as identity primary key,
  archetype text not null,   -- morning-dependency | energy-without-aim | low-floor | holding-it-together | general
  ref text not null,
  weight int not null default 1
);
CREATE TABLE word_deliveries (
  id bigint generated always as identity primary key,
  member_id bigint not null,
  ref text not null,
  delivered_on date not null,
  unique (member_id, delivered_on)
);
ALTER TABLE word_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_deliveries ENABLE ROW LEVEL SECURITY;
```
Seed `word_bank` with the 36 Steward's Verse references across the four patterns plus the general pool (Claude seeds from the existing curation).

**Function `word-arrives`.** POST `{ email }`. Acts only when today is kept per `discipline-day`. Deterministic frequency: `(member_id + days_since_epoch) hashed mod 3 == 0`, hard cap two deliveries per rolling seven days (Decision 6). Picks an unseen ref for `approved_members.archetype` (falls back to general), excludes refs delivered to that member in the last 30 days, pulls text verbatim from `bible_verses`, inserts the delivery, returns `{ "arrived": true, "ref": "1 Kings 19:7-8", "text": "...", "reason": "low-floor" }` or `{ "arrived": false }`. Nothing in this feature is ever for sale.

**Delivery moment (UI).** Right after the member submits a reflection (the exchange). Fallback: the day-complete moment when no reflection was written. Soft card, verse, reference, "Have the Governor read it" button.

**VERIFY:**
1. Seed check: `select archetype, count(*) from word_bank group by archetype` → four patterns plus general, total 36.
2. Determinism: the same qa member and date called three times → identical response all three times, exactly one `word_deliveries` row.
3. Unkept day → `arrived: false`, zero rows.
4. Text integrity: delivered text equals `select text from bible_verses` for the ref, byte for byte (Claude runs the comparison query).
5. Cap: simulate seven kept days; deliveries in any rolling seven days ≤ 2.
6. UI screenshot of the card at the reflection moment, three widths.

**GATE:** pass, then Page 5.

---

# PAGE 5 | STEWARD CIRCLES (owners: Claude backend, then Antigravity UI)

**Migration `create_steward_circles`:**
```sql
CREATE TABLE circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by bigint not null,          -- approved_members.id
  max_size int not null default 7,
  created_at timestamptz not null default now()
);
CREATE TABLE circle_members (
  circle_id uuid not null,
  member_id bigint not null,
  role text not null default 'member', -- creator = 'shepherd'
  joined_at timestamptz not null default now(),
  unique (circle_id, member_id)
);
CREATE TABLE circle_prays (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null,
  from_member bigint not null,
  for_member bigint not null,
  day date not null default current_date,
  unique (circle_id, from_member, for_member, day)
);
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_prays ENABLE ROW LEVEL SECURITY;
```

**Functions.** `circle-create` (name in, invite code out, creator joins as shepherd) · `circle-join` (code plus email, size cap enforced, two-tap on page) · `circle-leave` (immediate, no guilt copy) · `circle-day` (each member: display name, four discipline marks W P F R, Decision 9 settled yes, prayed-for state; checkmarks only, content never crosses) · `circle-nudge` (the pray gesture, frequency per Decision 10, copy "Pray for this one").

**UI.** My Circle card on the dashboard: today's row per member, quiet members show "quiet {n} days" with the pray button; create and join in the Me tab; leaving is one tap.

**VERIFY:**
1. Create, join by code with both qa stewards, third join attempt over cap 7 (seed five dummy memberships) → rejected.
2. `circle-day` raw JSON contains no emails and no entry text (Claude greps).
3. Nudge respects the decided frequency: second nudge same day (if Decision 10 = one) → rejected, exactly one `circle_prays` row.
4. Leave: member gone from `circle-day` both directions.
5. UI screenshots: full circle, quiet-member state, prayed state, at three widths.

**GATE:** pass, then Page 6.

---

# PAGE 6 | THE VOICE (owners: Claude backend, Antigravity wiring, Iiggie inputs)

**Prerequisite from Iiggie:** ElevenLabs account, API key added in Supabase secrets as `ELEVENLABS_API_KEY`, the four chosen voices (Decision 7), tier placement for the clone (Decision 8).

**Backend `governor-voice`.** POST `{ text, voice }` (voice = one of the four choir ids or a member's clone id). Flow: hash key `sha256(voice + '|' + text)` → if the audio object exists in the `voice-cache` storage bucket, return its URL; else generate via ElevenLabs, store, return. Rate limited per email like governor-ai. Scripture and lingo-pack strings therefore generate once ever, flat cost at any scale.

**The wrapper (Antigravity).** One `speak(text)` function in the page; ALL of the roughly twenty `speechSynthesis` call sites route through it; `speak()` calls `governor-voice` and plays the returned audio, with `speechSynthesis` as silent fallback if the fetch fails. The live voice picker's contents become the four choir voices.

**The paid unlock.** Member records about one minute, consent recorded with timestamp, clone created under the member's id, used only for their own profile, deleted on request. Lives in the tier per Decision 8. Built only after the choir ships clean.

**VERIFY:**
1. Same text and voice called twice: first response marks generated, second marks cached (Claude checks the storage object exists and the second call is fast).
2. The four voices each return distinct audio for the same sentence.
3. Page: robot voice gone from all call sites, `grep -c "speechSynthesis.speak" index.html` shows only the fallback inside `speak()`.
4. Kill-switch test: with a bad key, `speak()` falls back silently, no member-facing error.
5. Manual ear test by Iiggie: the Governor reads Lamentations 3:22-23 in each choir voice.

**GATE:** pass, then Page 7.

---

# PAGE 7 | QUIET DISCIPLINES + THE TAB RENAME (owner: Antigravity)

**Quiet disciplines.** Powered by `last_active` from Page 1. 0 to 1 days = warm. 2 to 3 = cooling, opacity eased. 4 plus = quiet, gray tone plus the one approved Governor line (Decision 5), delivered at most once per quiet spell. Never red, never a count.

**The tab rename.** Navigation becomes THE WORD, PRAYER, THE FAST, THE RECORD, plus Me. Bible 365 lives inside The Word; the Wall lives inside Prayer. Renames and grouping only.

**VERIFY:**
1. Screenshots of warm, cooling, quiet states at three widths; zero red pixels (Claude checks the images programmatically).
2. The Governor line passes the server constitution regex (no banned words, no em dashes).
3. Tab screenshots at three widths; every old deep link still resolves.

**GATE:** program complete. Delete all qa fixture rows (`source = 'qa-test'` members and everything keyed to them) and confirm counts return to baseline.

---

## THE TEN DECISIONS

**Settled by Ignacio, July 19, 2026 (doctrine, not suggestions):**

1. **SETTLED. Kept rhythm day = any one discipline.** A hard day where the member only prayed still holds the chain. (Page 2)
2. **SETTLED. Grace = one covered miss per calendar week per discipline.** The chain holds, the day is marked "Mercy covered {day}." A second miss the same week restarts quietly with Lamentations 3:22-23. (Page 2)
9. **SETTLED. Prayer is a counted discipline, as intercession only.** The observable outward act, praying FOR someone on the Wall or in a circle, or a logged prayer. Private prayer is never measured, per Matthew 6. Circles show four marks: W P F R. (Pages 1, 2, 5)

**Still open, for Iiggie:**

3. Cohort testimony member-initiated only? Suggested: yes, always. Wanted before Page 3 verification. (Page 3)
4. Circles cap seven, invite only? Suggested: yes. Wanted before Page 5. (Page 5)
5. The Governor's quiet line, exact wording. Wanted before Page 7. (Page 7)
6. Word frequency one in three kept days, cap two per week? Suggested: yes, tunable. Wanted before Page 4 verification. (Page 4)
7. The four choir voices, and does Iiggie's cloned voice sit above the choir as the Governor default? Wanted with the ElevenLabs key, before Page 6. (Page 6)
8. Personal clone tier and price? Suggested: inside Stewards Plus, bundled, never sold alone. (Page 6)
10. Circle pray gesture: match the Wall's three, or one per day? Suggested: one; presence, not applause. Wanted before Page 5 verification. (Page 5)

Pages 0 through 2 now have zero open questions. Build.
