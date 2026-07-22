# Slice 1 Implementation Plan — Next.js Shell and Preview Environment

Date: 2026-07-22\
Branch: `next-migration` (created from tag `production-baseline-2026-07-21`, commit `edae767`)\
Status: DRAFT, awaiting approval

## Objective

Stand up a Next.js App Router application inside the repository, alongside the untouched static root, with tooling, environment validation, design tokens, a global shell, and a verified Vercel preview. No feature behavior migrates in this slice. Nothing deploys to production.

## Hard constraints (restated from the handoff, plus the July 22 owner decision)

1. Nothing is pushed live until the migration is complete and approved. `main` receives no pushes of any kind during slices 1 through 8, because pushes to `main` auto-deploy production.
2. All work lands on `next-migration` via small reviewable commits. Vercel builds it as previews only.
3. The static root (`index.html` and the `whealthy-*.html` pages) is not deleted, moved, or edited.
4. No Supabase changes of any kind in this slice.
5. No secrets in the browser bundle, no secrets committed, environment names confirmed without exposing values.

## Repository layout decision

Because the repo root is the deployed static site, the Next.js app cannot occupy the root without touching production build behavior on main. The app lives in a subdirectory:

```
apps/next/            Next.js App Router application
  app/                routes: layout.tsx, page.tsx, error.tsx, loading.tsx, not-found.tsx
  src/lib/env.ts      zod-validated environment access, fail-fast at build
  src/styles/         design tokens (CSS custom properties) + globals
  next.config.ts
  package.json        self-contained; root package.json untouched
  tsconfig.json
  eslint + prettier config
  vitest + a first smoke test (renders shell, env validation rejects bad input)
```

Vercel implication: previews for `next-migration` must build `apps/next` while `main` keeps building the static root. Preferred mechanism: keep the current project serving `main` untouched, and create a second Vercel project (working name `whealthy-next`) pointed at the same repo with Root Directory `apps/next` and Production Branch `next-migration`. That project's "production" is only ever `next.thestewardsrhythm.com`, so the real site cannot be affected by it even accidentally. I will attempt this via API and fall back to a written runbook for Jake/Ignacio if the sandbox cannot reach the endpoints.

## Work items

1. Scaffold `apps/next` with Next.js (App Router, TypeScript strict, no experimental flags), pinned versions, lockfile committed. Pin Next.js `16.2.11` + React `19.2.8` (current patched stable as of July 22; Vercel refuses builds of vulnerable Next versions, confirmed empirically with 15.3.4).
2. ESLint + Prettier + `tsc --noEmit` + Vitest wired into `apps/next/package.json` scripts (`lint`, `typecheck`, `test`, `build`). All four must pass before every commit in this and later slices.
3. `src/lib/env.ts`: zod schema for the public runtime config (Supabase URL, anon key, function base URL) read from `NEXT_PUBLIC_*` variables; build fails loudly if absent or malformed. No service-role variable is defined anywhere client-reachable.
4. Design tokens: extract the recovered app's core palette, type scale (Oswald wordmark usage included), spacing, and breakpoints from `index.html` into CSS custom properties. Tokens only; no redesign decisions in this slice.
5. Global shell: root layout with fonts, mobile-first viewport config, a navigation frame placeholder mirroring the recovered app's top-level structure (dash, rhythm, bible, prayer, wall, portal, admin as labels only), plus `error.tsx`, `loading.tsx`, `not-found.tsx` boundaries. Every page dynamically responsive per the project rule; verified at 390px, 768px, 1280px.
6. A `/health` route rendering build metadata (commit SHA, build time) for parity tooling in later slices.
7. Vercel preview: second project as above, or documented fallback. Verify a preview URL builds green and renders the shell.
8. Docs: short `apps/next/README.md` covering local dev, scripts, and the no-production rule.

## Explicitly out of scope

Authentication, Supabase clients, any data fetching, real navigation targets, onboarding gates, `next.thestewardsrhythm.com` domain attachment (that waits until the preview is verified, per the handoff), and any dependency added to the repo root.

## Verification checklist (all must pass before the slice is declared done)

- `lint`, `typecheck`, `test`, `build` green in `apps/next`.
- `git diff --stat production-baseline-2026-07-21..HEAD` touches only `apps/next/**` and `docs/**`.
- Recovery gates still green at the slice head: 36/36 recovery tests, both secret scans, diff-hygiene (with the `slice-0-plan-approved` ref recreated at `bcc8f40`).
- Vercel preview deployment READY; shell renders on desktop and 390px mobile with no console errors.
- Production untouched: `thestewardsrhythm.com` still serves `dpl_ChUq9exs…` content, byte-identical `index.html` (re-verified via deployment metadata after the slice).
- No new environment variable value appears in any committed file or build log.

## Rollback

The slice is additive on a branch. Rollback is `git reset` of `next-migration` to `production-baseline-2026-07-21`, plus deletion of the `whealthy-next` Vercel project if created. Production has no dependency on anything in this slice.

## Approval requested

Approve this plan (or amend) and I will implement it on `next-migration` and report back with the preview URL and the verification results.
