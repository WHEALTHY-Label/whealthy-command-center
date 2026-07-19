# PAGE 7 | QUIET DISCIPLINES + THE TAB RENAME
## Brief for Antigravity (frontend only) | July 19, 2026

**Backend: nothing to build.** `discipline-day` already returns `last_active` per discipline. No migration, no function, no governor-ai change. Begin the frontend immediately.

---

## PART 1: QUIET DISCIPLINES (presentation only)

**Data source.** The existing `discipline-day` response, which the chips already fetch:
```
last_active: { word: "2026-07-19", prayer: "2026-07-19", fast: "2026-07-17", record: "2026-07-19" }
```
Real qa-steward-1 values today: Record/Word/Prayer warm (today), Fast cooling (last report 2 days ago).

**Compute quiet_days** per discipline = (Chicago today) minus last_active[discipline], using the same `dayKey`/Chicago logic as the chips.

**Three states, opacity only, never red, never a visible count on the card:**
| quiet_days | State | Treatment |
|---|---|---|
| 0 to 1 | Warm | Full opacity, normal. |
| 2 to 3 | Cooling | Opacity eased to ~0.6. |
| 4 or more | Quiet | Opacity ~0.4, plus ONE gentle line (below). |

**null last_active** (never done in the window): treat as Quiet visually, but the line is an invitation to start, not "has been quiet." Example: "The Record is waiting for its first entry." Never imply failure.

**The gentle line (Decision 5, needs Iiggie's exact wording before it ships).** Fixed strings, constitution-safe, no em dashes, no banned words, at most once per quiet spell. Proposed per discipline:
- The Word: "The Word has been quiet {n} days. Open today's reading?"
- Prayer: "Prayer has been quiet {n} days. Lift someone up today?"
- The Fast: "Your fast report has been quiet {n} days. Mark tonight?" (only while a fast is active)
- The Record: "The Record has been quiet four days. Want to speak tonight's entry?"

**Never:** no red, no badge count on the card, no "you missed {n}", no flame. The word is quiet, never late, lazy, or behind. The dimming is the whole signal; the line is the only text.

**Where it applies:** the dashboard discipline cards and each discipline surface. A truthful three-state render is delivered alongside this brief (`quiet_states_REAL_430.png`) as the visual reference.

---

## PART 2: THE TAB RENAME (labels + grouping only)

Navigation becomes: **THE WORD · PRAYER · THE FAST · THE RECORD · Me**.
- Bible 365 lives inside The Word.
- The Wall lives inside Prayer.
- This is renames and grouping only. Preserve every existing route, `data-page` value, deep link, and the Governor's navigation intents. Nothing that currently resolves may break. Member copy uses "discipline" names; never "features."

---

## VERIFICATION (for the gate)

- Screenshots of all three cooling states at 360/400/430, captured against a member with a real 4+ day quiet discipline (seed one if needed and state it). **Zero red pixels.** Open every image and confirm the discipline card, in the intended state, is actually in the viewport before attaching — not a modal, not a setup screen.
- Tab screenshots at three widths; confirm every prior deep link still resolves (spot-check Bible 365 and the Wall reachable under their new homes).
- Claude also renders the truthful state visuals independently.

**Decision still open:** Decision 5, the exact quiet-line wording, is Iiggie's. The cooling/opacity logic can be built now; the line text drops in when approved.
