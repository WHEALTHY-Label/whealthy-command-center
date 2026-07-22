# WHEALTHY Command Center — Claude Handoff

Date: 2026-07-22\
Repository: `WHEALTHY-Label/whealthy-command-center`\
Recovery PR: <https://github.com/WHEALTHY-Label/whealthy-command-center/pull/1>\
Recovery branch: `recovery/production-baseline-2026-07-21`

## Mission

Continue the careful migration of The Steward's Rhythm / WHEALTHY Command Center from its recovered static HTML application to a Next.js App Router application, while preserving behavior, securing Supabase access, and keeping the existing production application available throughout the migration.

The approved migration target is a temporary Vercel environment at `next.thestewardsrhythm.com`. Do not replace `thestewardsrhythm.com` until every migration slice has passed parity, security, and rollback review.

## Current State

Slice 0 production recovery is complete and independently reviewed.

- Clean reviewed recovery commit: `a5473b91bb67f2931aedeba34886c1db8da72b1f`
- Empty verified-author preview commit: `6c91340b68d3e1577263be39a9c53a56a1324b9b`
- PR #1 is open and was originally created as a draft.
- The replacement Vercel preview completed successfully:
  - Deployment: `dpl_7J2A7iF6EvwtRZ1JzRcgicXiTMPw`
  - State: `READY`
  - GitHub Vercel status: success
- Existing production deployment remains:
  - Deployment: `dpl_AEjt6dY2YzmSWrxSnTofERBH7SWm`
  - State: `READY`
  - Production source commit metadata: `bc66f8fa3ca814a5ec9ada254072a092519bbce6`
- The recovery PR has **not been merged**.
- The annotated tag `production-baseline-2026-07-21` has **not been created**.
- A request to mark the PR ready and merge it was interrupted before any merge mutation occurred. Verify GitHub state rather than assuming.

## Verified Recovery Evidence

- Production HTML is recovered byte-for-byte:
  - SHA-256: `b26274c35f862d67f49409e593af81b90a7db273446fe4fd1e3888a734dff1c3`
  - Bytes: `1,032,340`
  - Lines: `20,785`
- Supabase project: `yzaxzmuuvozonhgwhlim`
- Vercel project: `prj_0Ju0B5KYjA8z9vrlghwTp2MhLUw2`
- Vercel team: `team_ePajvo1uCVVsbvJHZsXPrepW`
- Deployed Edge Functions: `81`
  - Byte-exact captures: `74`
  - Intentionally redacted: `7`
- Remote migration records: `46`
- Supabase security advisor errors: `0`
- Recovery tests: `36/36` passing
- Read-only production smoke tests: `3/3` passing
- Reachable Git blobs scanned for secrets: `437`
- The rejected webhook credential has zero occurrences in the publishable branch history.

Primary evidence:

- `docs/recovery/2026-07-21/README.md`
- `docs/recovery/2026-07-21/production-manifest.json`
- `docs/recovery/2026-07-21/edge-functions.json`
- `docs/recovery/2026-07-21/migrations.json`
- `docs/recovery/2026-07-21/database-recovery-limitations.md`
- `docs/recovery/2026-07-21/add-member-credential-redaction.md`
- `docs/superpowers/specs/2026-07-21-html-to-nextjs-migration-design.md`
- `docs/superpowers/plans/2026-07-21-slice-0-production-recovery.md`

## Critical Security Constraint

One shared webhook credential was hard-coded across seven deployed Edge Functions. The recovery branch removes the literal and replaces it with `Deno.env.get('NURTURE_WEBHOOK_SECRET')` using fail-closed behavior.

The seven redacted functions are recorded in `docs/recovery/2026-07-21/edge-functions.json` and the redaction note. Before any of these recovered functions are deployed:

1. Rotate the exposed credential with the receiving webhook system.
2. Store the replacement as the Supabase secret `NURTURE_WEBHOOK_SECRET`.
3. Verify each affected path fails closed when the secret is absent.
4. Deploy only after explicit production-change approval.

Never recover, print, recommit, or reuse the old value. Never push local quarantine refs. Push only explicit safe refspecs.

## Database Recovery Limitation

The exact historical SQL bodies for the 46 remote migrations were unavailable. They are truthfully marked `missing`; no SQL was invented.

The checked-in schema baseline is a catalog-derived, zero-row-data, non-replayable review artifact. It covers tables, columns, constraints, indexes, RLS flags, policies, views, grants, function metadata, and triggers. Function bodies were omitted. Do not treat this snapshot as a migration to apply.

The Supabase CLI dump workflow attempted to initialize a temporary remote login role and failed with permission denied. Do not retry it casually. Continue using read-only MCP/catalog queries unless a database administrator explicitly authorizes another workflow.

## Non-Negotiable Migration Rules

1. Keep `thestewardsrhythm.com` on the current static production application until final cutover approval.
2. Build and validate Next.js at `next.thestewardsrhythm.com`.
3. Do not deploy or alter Vercel production during implementation slices.
4. Do not mutate Supabase production unless the specific change is separately approved.
5. Never expose Supabase service-role or other secret credentials to browser code.
6. Keep authorization server-side and preserve RLS as the final row-level enforcement layer.
7. Do not use user-editable JWT `user_metadata` for authorization.
8. Preserve Scripture text from the fixed source/library/API; never AI-generate Scripture.
9. Preserve recovered production behavior before redesigning it.
10. Each slice must remain independently reviewable and reversible.

## Approved Migration Strategy

Use nine implementation slices after the mandatory Slice 0 recovery.

### Slice 1 — Next.js Shell and Preview Environment

- Add a Next.js App Router application without deleting the static root.
- Establish TypeScript, linting, test scripts, environment validation, and Vercel preview settings.
- Create the global shell, fonts, design tokens, navigation frame, and error/loading boundaries.
- Configure `next.thestewardsrhythm.com` only after the preview is verified.
- No feature behavior migration yet.

### Slice 2 — Authentication and Session Boundary

- Implement Supabase SSR/browser clients with secure cookie handling.
- Use OTP login as approved.
- Validate sessions server-side with `getUser()`/claims appropriate to current Supabase guidance.
- Reproduce onboarding, approval, Skool-membership, and tour gates.
- Add route protection and logout behavior.
- Do not migrate admin authorization until its exact source-of-truth fields are confirmed.

### Slice 3 — Dashboard / Steward's Rhythm Home

- Migrate the dashboard landing experience and its read-only data.
- Preserve Steward's Rhythm terminology, hierarchy, state, and navigation.
- Improve UI using the approved design system without changing business logic.
- Compare desktop and mobile behavior to recovered production.

### Slice 4 — Rhythm Core

- Migrate assessment, build, activation, status, check-in, season, slot, feed, and nudge flows.
- Preserve ordering, editable slots, suggestions, reasoning, season banners, and fresh-start behavior.
- Keep Edge Function contracts stable until a separately reviewed API migration is justified.

### Slice 5 — Bible, Prayer, and Reflection

- Migrate Bible reading, fixed Scripture source, marks/state, reflections, prayers, and prayer state.
- Preserve content provenance and access controls.
- Validate overflow, typography, mobile layout, and direct-link navigation.

### Slice 6 — Community and Walls

- Migrate prayer/testimony wall reads and permitted interactions.
- Preserve moderation, signing, reporting, answering, praying, amen, and seen-state authorization.
- Re-audit every write path against RLS and Edge Function authentication.

### Slice 7 — Products, Orders, Affiliates, and Subscriptions

- Migrate product portal, order history/tracking, checkout, subscriptions, affiliates, and referral tracking.
- Treat Stripe, Shopify, and webhook paths as high risk.
- No live payment/webhook mutation in browser tests.

### Slice 8 — Administration and Analytics

- Migrate registrations, members, settings, Rhythm stats, analytics, and operational controls.
- Require explicit server-side admin authorization for every route and action.
- Do not rely on hidden UI as access control.
- Verify that analytics queries do not leak cross-member data.

### Slice 9 — Parity, Cutover, and Rollback

- Run route-by-route desktop/mobile visual comparison.
- Run authentication, authorization, RLS, accessibility, performance, and failure-state tests.
- Confirm environment-variable names and targets without exposing values.
- Freeze production changes during the final parity window.
- Produce cutover and rollback runbooks.
- Cut over the primary domains only after written approval.

## Recommended Next Actions

1. Inspect PR #1 and verify whether it is still draft/open.
2. If human approval remains valid, mark it ready and merge the exact green head.
3. Pull `main` with fast-forward only and verify the merge result.
4. Create the annotated tag only after merge:

   ```bash
   git tag -a production-baseline-2026-07-21 \
     -m "Verified Vercel and Supabase production baseline before Next.js migration"
   git push origin production-baseline-2026-07-21
   ```

5. Create a new branch/worktree for Slice 1 from the tagged baseline.
6. Write a detailed Slice 1 implementation plan before changing framework structure.
7. Confirm Vercel domain ownership and environment names before assigning `next.thestewardsrhythm.com`.

## Required Pre-Merge / Pre-Slice Commands

Run from the clean recovery worktree:

```bash
npm test --prefix tools/recovery
npm run smoke --prefix tools/recovery
node tools/recovery/scan-history-secrets.mjs
node tools/recovery/scan-secrets.mjs --recursive supabase/functions docs/recovery/2026-07-21
node tools/recovery/verify-diff-hygiene.mjs
git status --short
```

Expected:

- 36 unit/integrity tests pass.
- 3 read-only smoke tests pass.
- Reachable-history scan passes.
- Recursive current-source scan passes.
- Diff-hygiene gate permits only hash-verified exact-production whitespace findings.
- Worktree is clean.

## Git Safety

Two local quarantine branches intentionally retain rejected credential-bearing commits for forensic continuity. They are not ancestors of the publishable recovery branch.

Never run:

```bash
git push --all
git push --mirror
```

For the recovery branch, use only:

```bash
git push origin HEAD:refs/heads/recovery/production-baseline-2026-07-21
```

Before any push, verify the intended HEAD and run the history scanner.

## Definition of Done for the Migration

The migration is complete only when:

- All nine slices are merged and individually verified.
- `next.thestewardsrhythm.com` passes parity and security review.
- No browser bundle contains privileged credentials or authorization logic that belongs server-side.
- RLS and server-side authorization tests pass for member and admin boundaries.
- Payment, webhook, and administrative paths have explicit rollback procedures.
- Primary-domain cutover receives written approval.
- A rollback to the tagged static baseline has been rehearsed and documented.
