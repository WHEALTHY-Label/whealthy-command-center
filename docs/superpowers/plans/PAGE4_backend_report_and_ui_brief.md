# PAGE 4 | THE WORD THAT ARRIVES
## Part A: Backend Report (Claude, complete and verified) + Part B: UI Brief (Antigravity)
### July 19, 2026

---

## PART A: BACKEND REPORT (DONE, verified in band)

**Migration applied:** `create_word_bank_and_deliveries`
- `word_bank` (id, archetype, ref, weight, unique(archetype,ref)). RLS ON, 0 public policies.
- `word_deliveries` (id, member_id, ref, delivered_on, unique(member_id, delivered_on)). RLS ON, 0 public policies. Index on (member_id, delivered_on).

**Seed:** 36 references. morning-dependency 4, energy-without-aim 4, low-floor 4, holding-it-together 5, general 19 (the daily pool plus Romans 12:2). Every ref keyed to the four `approved_members.archetype` values plus `general` fallback.

**Function deployed:** `word-arrives` v1 (verify_jwt off). POST `{ email }`.
- Reuses the owned Bible layer: pulls verse text verbatim from `bible-verses` (which handles Psalm/Psalms alias, ranges, numbered books). Scripture is never generated.
- Reuses the ledger: calls `discipline-day` for today and requires a KEPT day (Decision 1: any one discipline).
- Deterministic frequency gate: `fnv1a(member_id + "-" + chicagoToday) % 3 === 0` — about one kept day in three, same member and date always decide the same way.
- Hard cap: at most 2 deliveries in the rolling 7 days.
- Archetype-keyed pick (falls back to general), excludes anything delivered to that member in the last 30 days; if all seen, allows a repeat rather than failing.
- Idempotent per day via `unique(member_id, delivered_on)`: a second call the same day returns the same verse (`reason:"already-today"`).
- Returns `{ arrived:true, ref, text, reference, reason:<archetype> }` or `{ arrived:false, reason }`. Nothing here is ever for sale.

**Verification (all PASS, in band):**
| Test | Result |
|---|---|
| Seed counts | 36 total: m-d 4, e-w-a 4, low-floor 4, holding 5, general 19 |
| All 36 refs resolve | 36/36 return real verses from `bible_verses`, 0 empty/error |
| Delivery (qa-1, low-floor, kept, gate open) | `arrived:true, Psalm 127:2, reason:low-floor` — on-pattern |
| Delivered text byte-exact vs bible_verses | YES |
| Determinism (3 calls same day) | identical verse each time |
| Idempotent branch (sequential) | `reason:"already-today"`, same ref |
| Unique row under concurrent calls | exactly 1 `word_deliveries` row |
| Unkept day (qa-2) | `arrived:false, day-not-kept` |
| Non-member | `arrived:false, not-a-member` |
| Weekly cap (2 in 7 days) | `arrived:false, weekly-cap` |
| word_bank / word_deliveries RLS | ON, 0 public policies |

**Contract for the UI:**
```
POST /functions/v1/word-arrives  { email }
  -> { arrived:true, ref, text, reference, reason }   (reason = archetype)
   | { arrived:false, reason }                         (day-not-kept | not-today | weekly-cap | already-today | not-a-member)
```

**Housekeeping:** function source `word-arrives` was deployed via MCP; mirror it into `supabase/functions/word-arrives/` with the Page 4 commit so git tracks it (same as the cohort functions).

---

## PART B: UI BRIEF (Antigravity, build the page half)

Build "A Word Arrives" as a soft card at the reflection exchange.

1. **When to call.** Right after a member submits a Bible-365 reflection, call `word-arrives { email }`. If `arrived:true`, show the card. If `arrived:false`, show nothing at all (no empty state, no "come back tomorrow" — the absence is the point). Fallback trigger: if a member completes their day without a reflection, call it at the day-complete moment.
2. **The card.** Eyebrow "A word arrived", the `text` in quotes, the `reference` below in lime, and a subtle tag like "Chosen for {archetype as a name}". A "Have the Governor read it" button that speaks the verse (routes through the same speak path Page 6 will formalize; for now, existing TTS). A truthful design reference rendered from the real delivery is delivered alongside this brief (`word_card_430.png`).
3. **Never.** No prize language, no points, no "streak bonus", nothing for sale, never a generated verse. Real scripture or nothing. No red.
4. **Styling.** Match the Steward's Verse / chain-chip system. Mobile first, 44px targets.

**Screenshots for the gate:** capture the card at 360/400/430 from a REAL `word-arrives` delivery (do not inject a mock response — that failed twice on Page 3). Since delivery depends on the deterministic gate, use qa-steward-1 whose gate is open today, or temporarily seed the member/date to pass; state which. Open every image and confirm the card is on screen before attaching. Note: verification visuals are now also produced independently by Claude.
