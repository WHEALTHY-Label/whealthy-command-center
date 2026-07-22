# Slice 4 Implementation Plan — Rhythm Core

Date: 2026-07-22\
Branch: `next-migration` (from tag `production-baseline-2026-07-21`)\
Status: DRAFT, awaiting approval

## Objective

Migrate the heart of the app: the Steward's Rhythm lifecycle, assessment, AI-proposed draft, steward approval, the daily timeline with completion and grace, editable slots, seasons, adaptive nudges, and the subscribable calendar. This is the first write-heavy slice. Edge Function contracts stay exactly as they are; nothing deploys to production; no Supabase or backend changes.

## The lifecycle to reproduce (six screens, eight laws)

The eight non-negotiable laws carry over verbatim: (1) AI proposes, steward approves, never auto-apply or reshuffle; (2) completion and grace, never a breakable streak or shame; (3) warm, restrained nudges; (4) value before depth; (5) a product is a scheduled stewardship slot, never scarcity; (6) start small (~5-6 slots); (7) mobile-first, clean to 390px; (8) brand voice, no em dashes.

1. Season threshold ("First, your season", 1 Cor 14:40): shown to a member whose quiz is not done. A single "Begin" routes to the assessment. No skip, no shame.
2. Rhythm Assessment: a short, stepped, conversational flow collecting the 5 rMEQ chronotype items (exact wording and scoring in `claude/rhythm_rmeq_items.md`), wake/sleep/work shape, non-negotiables and family anchors (as when-then), accountability preference, and fasting opt-in. Ends on a reflected-back summary, then moves to the build. Writes via `rhythm-assess`.
3. Draft review (the approval gate): `rhythm-build` returns a draft of 1-2 core anchors plus suggestions, each with its if-then line and a per-slot "why". Rendered as an editable timeline; the steward edits, removes, adds a suggestion, or accepts. A single "Activate my rhythm" calls `rhythm-activate`. Nothing is scheduled until then.
4. My Rhythm daily view: `rhythm-status` drives it, slots grouped by window (morning/midday/afternoon/evening), each with title, time or cue, if-then, per-slot why, and a tap-to-complete control. Completion shows a filling ring and a quiet "Day complete"; adherence is a gentle rolling percentage and a filled-days count, never a breakable streak or red on a miss. Product slots show the dose once and, if unclaimed, a soft service line. "Subscribe to your rhythm" exposes the ICS feed URL. Includes the weekly fresh-start moment and the season banner from `rhythm-status`.
5. In-app nudges: poll `rhythm-nudge-check`, render warm toasts, adaptive (upcoming, "pick it back up" only under 75% adherence, weekly fresh-start). Never constant.
6. Drum loader: the brand loading state on the build step.

## Endpoints (all live, email-gated, contracts unchanged)

`rhythm-assess`, `rhythm-build`, `rhythm-activate`, `rhythm-checkin`, `rhythm-status`, `rhythm-slot` (add/update/delete/reorder, ownership-enforced, soft cap 14), `rhythm-season` (commit/end 21/40/90), `rhythm-feed` (GET ?token=, ICS, token-auth only), `rhythm-nudge-check`. All confirmed ACTIVE on the project.

## Write-path architecture (the important part)

Every write goes through a server action that derives the member email from the validated session (`getAuthedEmail()`), never from client input, and POSTs to the edge function with `?email=` and the publishable key. The edge functions enforce ownership server-side (a cross-member id returns 404); we rely on that as the backstop, not the UI. No service-role key anywhere. No second Supabase client in the browser for these calls.

- Reads: `rhythm-status` in a server component (already partly used by the dashboard).
- Assessment / build / activate / season: server actions, then revalidate the affected routes.
- Check-off and slot edits: server actions with optimistic UI, reconciled against the server response; a failed write rolls back and surfaces a quiet error.
- Nudges: a small client poller hitting a server action wrapper around `rhythm-nudge-check`, rendered as toasts. Kept minimal.
- ICS: render the `rhythm-feed?token=` URL as an add-to-calendar action; the token comes from `rhythm-status`, never fabricated.

## Suggested build order (committed as sub-steps on the branch; preview updates each time)

1. `rhythm-status` typed client + the read-only My Rhythm daily view (timeline grouped by window, adherence, season banner, fresh-start), replacing the dashboard's read-only "Today's disciplines" with the real timeline route.
2. Check-off via `rhythm-checkin` (completion + grace), optimistic.
3. Assessment flow → `rhythm-assess`, with the season threshold gate.
4. Draft review → `rhythm-build` + `rhythm-activate`, editable via `rhythm-slot`.
5. Season commit/end → `rhythm-season`; nudges poller → `rhythm-nudge-check`; ICS subscribe; drum loader.

Each sub-step keeps all gates green and is independently reviewable.

## Testing and gates

- All four gates stay green at every commit (lint, typecheck, vitest, build).
- New unit tests: rMEQ scoring → chronotype cutoffs (evening ≤11 / intermediate 12-17 / morning ≥18, matching the deployed function), slot grouping by time window, adherence/consistency formatting (grace excluded, no breakable streak), day_mask handling, and the nudge-visibility rules (slipping only under 75%).
- Preview verification on `whealthy-next`: as a member, walk assessment → draft → activate → daily check-off → season, confirm writes land (re-read `rhythm-status`), and that ownership holds. Compare desktop and 390px mobile to recovered production.
- Recovery gates re-run at each slice head; production confirmed untouched.
- First Steps auto-reporting can begin returning here for the steps whose targets now exist (rhythm-related), consistent with the Slice 3 deferral.

## Out of scope

The Bible/Prayer/Wall/Community/Portal/Admin pages (their slices), the prayer and journal check-in hooks that feed rhythm adherence (they live in those features' slices; the auto-derivation already happens server-side in `rhythm-status` and needs no new code here), admin authorization enforcement, and any backend change.

## Risks and mitigations

- Write correctness: this is the first slice that mutates member data. Mitigation: session-derived identity, server-side ownership enforcement, optimistic UI with rollback, and re-reading `rhythm-status` after each write to confirm.
- Backend shape drift: fetchers stay tolerant and degrade to safe empty states, never crash, as in Slice 3.
- Size: this is the largest slice; building it in the five sub-steps above keeps each change small and reviewable, and lets you eyeball progress on the preview between them.

## Rollback

Additive on `next-migration`; reset to the prior commit. No production dependency. (Member data written during preview testing is real data on the live Supabase; use a test/QA member for destructive walk-throughs, as the backend build did.)

## Approval requested

Approve the scope and the five-sub-step order (or trim, e.g. defer nudges/ICS to a follow-up), and I will build on `next-migration`, committing each sub-step and reporting with the preview.
