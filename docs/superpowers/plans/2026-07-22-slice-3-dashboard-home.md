# Slice 3 Implementation Plan — Dashboard / Steward's Rhythm Home

Date: 2026-07-22\
Branch: `next-migration` (from tag `production-baseline-2026-07-21`)\
Status: DRAFT, awaiting approval

## Objective

Migrate the signed-in home (the live app's "Command Center" / `dashView`) and the real navigation shell around it, rendering from live read-only data. Preserve the Steward's Rhythm terminology, hierarchy, state, and navigation exactly; improve the UI with the design system without changing any business logic. Nothing deploys to production.

## What the live home shows (the behavior to preserve)

Inside the three-section sidebar (General / Disciplines / Community & More), the home renders, top to bottom:

1. Welcome + Daily Directive card: avatar, member name, and the Daily Directive beneath. The directive text is the fast-phase line during an active fast ("Day N of [duration], [phase focus]") and the AI daily directive otherwise.
2. Your Bundle card: the claim CTA ("Start your governed day / See your personalized plan"), reflecting whether the bundle is claimed.
3. First Steps checklist: "First Steps, {archetype}, n of 7" with a progress bar; each step links to its destination (bundle, word, wall, record, community, fast, code). Auto-checks from live state and server flags.
4. Today's disciplines: the day's rhythm anchors (the timeline), read-only here.
5. Steward Fellowship card: a static nudge (no fabricated data).

(Removed in the live app and NOT to be reintroduced: the "Tonight's Entry" mic card, the "At a Glance" leaderboard, and the in-dashboard community feed, which now lives in the Community tab.)

## Read-only data sources (all keyed by the session email, server-side)

- `verify-member` — identity, first name, archetype / archetype_name, `first_steps`, `tour_done_at`.
- `onboarding-state` — gate, bundle (key/name), `bundle_claimed`, discount (already wired in Slice 2).
- `rhythm-status` — the active plan's slots for "Today's disciplines" (read-only render; the editable rhythm is Slice 4).
- `governor-state` — the AI daily directive; the fast-phase directive is derived from the fast fields the same way the live app computes it.

All calls reuse the Slice 2 pattern: the email comes from the validated session (never client input), publishable key as apikey. No writes in this slice.

## Navigation shell

Evolve the Slice 1 `NavFrame` placeholder into the real three-section sidebar, preserving the live structure and labels:

- General: Home, Claim Bundle, Try All, The Record
- Disciplines: Prayer (Prayer Wall, Testimony Wall, My Prayers), Scripture, Fasting (The Fast, Cohort Challenge), Circles
- Community and More: Community, Affiliate Center, Product Portal
- Admin (master/admin only), and Sign out in the footer.

Home routes to the migrated dashboard. Every other destination is a clearly labeled "coming in a later slice" placeholder page (they migrate in Slices 4-8), so the hierarchy and routing are real and navigable now without pretending the features exist. Mobile: the sidebar collapses to the app's mobile navigation pattern; verified at 360-390px.

## Deliberately deferred (stated, not silently dropped)

- First Steps auto-reporting (the write-on-visit that sets flags) and the guided Tour (`tour-state` writes, spotlighting every nav item) are NOT built here. Both are write paths that depend on destination features that do not exist yet in the new app, so there is nothing to complete or spotlight. First Steps renders read-only progress from the server flags; the auto-report and the tour return in the slice where their targets land (and the tour naturally at the end). This is a scope boundary, not a cut.
- The editable rhythm (add/edit/reorder slots) is Slice 4; the home shows today's anchors read-only.

## UI approach

Rebuild the home with the extracted design tokens and the shell from Slices 1-2: the merged directive card, the bundle card, the First Steps progress, and the disciplines list as clean components. Same information hierarchy and copy as the recovered app; no business-logic or wording changes beyond the header/help standard already in production. Everything mobile-first and responsive per the project rule.

## Testing and gates

- All four gates stay green (lint, typecheck, vitest, build).
- New unit tests: the directive selector (fast-phase vs AI daily, given fast state), the First Steps progress computation (n of 7 from flags), and the bundle-card state (claimed vs unclaimed).
- Preview verification on `whealthy-next`: sign in as a member and confirm the home renders name, directive, bundle state, First Steps count, and today's disciplines from live data, desktop and at 390px, against the recovered production home.
- Recovery gates re-run at the slice head; production confirmed untouched.

## Out of scope

Every feature page's interior (their slices), all write paths, the tour, admin authorization enforcement, and any Supabase or edge-function change.

## Rollback

Additive on `next-migration`; reset to the prior commit. Production unaffected.

## Approval requested

Two scope calls to confirm: (1) build the real three-section sidebar now with placeholder destinations, and (2) defer First Steps auto-reporting and the guided tour to their relevant later slices, rendering First Steps read-only for now. Approve or adjust, and I will build on `next-migration` and report with the preview.
