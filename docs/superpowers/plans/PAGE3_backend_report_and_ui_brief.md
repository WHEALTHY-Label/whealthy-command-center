# PAGE 3 | THE COHORT CHALLENGE
## Part A: Backend Report (Claude, complete and verified) + Part B: UI Brief (Antigravity)
### July 19, 2026

---

## PART A: BACKEND REPORT (DONE, verified in band)

**Migration applied:** `create_challenge_cohorts`
- New table `public.challenge_cohorts` (id, name, start_date, end_date, status default 'open', created_at). RLS ON, zero public policies (service role only).
- `ALTER TABLE public.fasts ADD COLUMN cohort_id uuid` (nullable). The only existing-table touch in the whole program.

**Functions deployed (both verify_jwt off, like the other page-called functions):**
- `cohort-join` v1 — POST `{ email, cohort_id }`. Stamps the member's ACTIVE fast (status='active') with the cohort. Rejects if the cohort is missing (404), not open (409), or the member has no active fast (409). Idempotent: re-joining the same cohort returns `{joined:true, already:true}`.
- `cohort-board` v1 — POST `{ cohort_id }`. Returns `{ cohort, day, of, status, members:[{name, days_kept}] }`. `day` and `of` computed in America/Chicago (matches discipline-day and the client dayKey). `days_kept` = count of that member's fast reports (record_entries with the cohort fast_id, not burned). Members ordered by days_kept desc, then join date. Names are first-name + last-initial only.

**Verification (all PASS, in band):**
| Test | Result |
|---|---|
| Join with no active fast | 409 "No active fast to join a cohort with." |
| Join open cohort (qa-2) | 200 `{joined:true, cohort_name:"The QA Fast"}` |
| Join closed cohort | 409 "This cohort is not open for joining" |
| Join open cohort (qa-1, after seeding fast) | 200 joined |
| Board result | `day:7, of:30, members:[{QA 1, 3},{QA 2, 1}]` — ordered by days_kept desc |
| Email in board payload | none (privacy floor holds) |
| wall_posts source='challenge' | 0 (nothing auto-posted) |
| challenge_cohorts RLS | enabled, 0 public policies |
| qa-2 stamped to open cohort, not closed | confirmed |

**Contracts for the UI to call:**
```
POST /functions/v1/cohort-join   { email, cohort_id }  -> { joined:true, cohort_name } | { error }
POST /functions/v1/cohort-board  { cohort_id }         -> { cohort, day, of, status, members:[{name, days_kept}] } | { error }
```

---

## PART B: UI BRIEF (Antigravity, build the page half)

Build the group board inside **The Fast** and the join + completion moments. No backend work; the two functions above are live.

1. **Show the board when the member's active fast has a cohort_id.** Read the member's active fast; if it carries a cohort_id, call `cohort-board` and render:
   - Header: the cohort name, and "Day {day} of {of}".
   - Rows: each `{name, days_kept}` as "{name} · {days_kept} days kept". Highlight the current member's own row in lime (match by position or by re-deriving their display name; never print emails).
   - Order is already correct from the API; render as returned.
2. **Join flow.** Where a member with an active fast can join an open cohort, a two-tap confirm calls `cohort-join`. On success, refresh the board. On the 409 errors, show the returned `error` text plainly (no red alarm styling; it is guidance, not failure).
3. **Completion / testimony (Decision 3: member-initiated only).** When the member reaches the final day, OFFER a testimony post through the EXISTING `wall-post` function with `source:'challenge'`. It must be a button the member taps, never automatic. Copy: "Only if you want to. The app never posts for you."
4. **Styling:** same glassmorphic system as the chain chips. Mobile first, 44px targets, no red. Member copy uses "the fast," "days kept," "cohort" or "the group," never "features."

**Screenshots required for the gate:** the board at 360, 400, 430; the completion/testimony-offer state at one width. Dismiss the claim modal first (`closeClaimModal()` fires but the onboarding re-opens it; capture as a member WITH a bundle, or suppress `checkClaimModal`, so the board is actually visible). Open every screenshot and confirm the board is on screen before attaching.

**Do not touch:** governor-state, the Wall functions themselves (only call `wall-post` as the app already does), any money path.
