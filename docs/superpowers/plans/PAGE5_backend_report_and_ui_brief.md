# PAGE 5 | STEWARD CIRCLES
## Part A: Backend Report (Claude, complete and verified) + Part B: UI Brief (Antigravity)
### July 19, 2026 · Decisions 9 (prayer counts, W P F R) and 10 (up to 3 prays/day) settled

---

## PART A: BACKEND REPORT (DONE, verified in band)

**Migration applied:** `create_steward_circles` + `circle_prays_atomic_cap`
- `circles` (id, name, invite_code unique, created_by, max_size default 7, created_at). RLS ON, 0 public policies.
- `circle_members` (circle_id FK cascade, member_id, role, joined_at, unique(circle_id, member_id)). RLS ON.
- `circle_prays` (id, circle_id FK cascade, from_member, for_member, day, nth, created_at). RLS ON. **Atomic cap:** `nth` in 1..3 with unique(circle_id, from_member, for_member, day, nth), so no race can exceed 3.

**Five functions deployed (verify_jwt off):**
- `circle-create` `{email, name}` → generates a 6-char invite code (no ambiguous chars), creates the circle, adds the creator as `shepherd`. Returns `{created, circle_id, name, invite_code}`.
- `circle-join` `{email, invite_code}` → validates code, enforces max_size, adds member. Idempotent for an existing member.
- `circle-leave` `{email, circle_id}` → removes membership, no guilt copy.
- `circle-day` `{circle_id, email}` → per member: display name (first + last initial), role, four discipline marks `word/prayer/fast/record` for today, and the viewer's own `i_prayed_count` per member. Checkmarks only. **No emails, no content, no miss counts.**
- `circle-nudge` `{email, circle_id, for_member}` → the pray gesture. Guards self and non-members. Atomic cap of 3 per person per day.

**Verification (all PASS, in band):**
| Test | Result |
|---|---|
| Create | invite code `GGH7Z2`, creator role `shepherd` |
| Join (qa-2, qa-3) | joined:true |
| Join bad code | 404 "That invite code was not found" |
| Board (circle-day) | 3 members, four marks each (W P F R), first-name+initial, **no emails** |
| Nudge self | 400 "You cannot pray-nudge yourself" |
| Nudge non-member | 403 "Both members must be in the circle" |
| Nudge sequential cap | 3rd prays (remaining 0), 4th capped with gentle message |
| **Nudge 5 concurrent taps** | **exactly 3 rows (nth 1,2,3) — atomic cap holds under race** |
| Size cap at 7 | 8th join → 409 "This circle is full" |
| Leave | {left:true}, member gone from the board |
| RLS all 3 tables | ON, 0 public policies |

**A real finding, fixed:** the first `circle-nudge` used count-then-insert, which a rapid double-tap could beat (two concurrent taps both passed the count check). Hardened with the `nth` unique constraint so the database itself caps at 3 regardless of concurrency; re-tested with 5 simultaneous taps → exactly 3 rows.

**Contracts for the UI:**
```
POST /functions/v1/circle-create  {email, name}                 -> {created, circle_id, name, invite_code} | {error}
POST /functions/v1/circle-join    {email, invite_code}          -> {joined, circle_name, circle_id} | {error}
POST /functions/v1/circle-leave   {email, circle_id}            -> {left:true} | {error}
POST /functions/v1/circle-day     {circle_id, email}            -> {circle, circle_id, today, members:[{member_id, name, role, word, prayer, fast, record, i_prayed_count}]} | {error}
POST /functions/v1/circle-nudge   {email, circle_id, for_member}-> {prayed, count, remaining} | {prayed:false, capped:true, message} | {error}
```

**Housekeeping:** mirror the five `circle-*` function sources into `supabase/functions/` with the Page 5 commit.

---

## PART B: UI BRIEF (Antigravity)

Build "My Circle" on the dashboard and the create/join flow in the Me tab. A truthful render from real data is delivered alongside (`circle_card_REAL_430.png`).

1. **My Circle card (dashboard).** Call `circle-day {circle_id, email}` for the member's circle. Render each member as: display name (own row highlighted lime, shepherd tagged), four discipline marks **W P F R** (Decision 9), where fast is null-safe (dashed/neutral when the member has no active fast). Never print emails or member_id to the screen; member_id is used only as the `for_member` argument to the nudge.
2. **The pray gesture (Decision 10: up to 3/day).** Beside each member who is not the viewer, a "Pray for this one" button calling `circle-nudge`. Reflect state from `i_prayed_count`: after 3, show "Prayed today" disabled. On success, show "Prayed. They will see it." No public tally of how many prayed for someone (presence, not a score).
3. **Create / Join (Me tab).** Create asks a circle name → shows the invite code to share. Join asks for the invite code, two-tap confirm, calls `circle-join`; show 404/409 error text plainly, dim style, no red. Leaving is one tap, no guilt copy.
4. **Never.** No entry content, no miss counts, no red, no damage to the group for one person's day. Presence only.
5. **Styling:** the glassmorphic system. Mobile first, 44px targets.

**Invite-code UX note (same as cohorts):** members share a 6-char code today. Consider invite links later so nobody types a code by hand. Flagged, not blocking.

**Screenshots for the gate:** the My Circle card at 360/400/430 from a REAL `circle-day` response (no injected mock — that failed on Page 3). Open each image and confirm the circle card is actually in the viewport before attaching. Claude also renders the truthful visual independently.
