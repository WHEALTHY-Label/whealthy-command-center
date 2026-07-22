# whealthy-next

The Steward's Rhythm / WHEALTHY Command Center — Next.js App Router migration.

## Status

Slice 1: the application shell and preview environment. Global frame, design
tokens, fonts, environment validation, and error/loading boundaries only. No
feature behavior is migrated yet.

## The one rule

**This app never serves production until the Slice 9 cutover is approved in
writing.** The live site runs from the static baseline (repo root
`index.html`, tag `production-baseline-2026-07-21`) served by the separate
`whealthy` Vercel project. This app builds only on the `next-migration`
branch and deploys only as previews (Vercel project `whealthy-next`). Do not
merge this directory to `main` — a push to `main` auto-deploys production.

## Local development

```bash
cd apps/next
npm install
npm run dev        # http://localhost:3000
```

## Gates (all must pass before every commit)

```bash
npm run lint       # eslint (next/core-web-vitals + next/typescript)
npm run typecheck  # tsc --noEmit, strict
npm run test       # vitest (env validation)
npm run build      # next build
```

## Layout

```
src/
  app/
    layout.tsx        root shell: fonts, viewport, tokens
    page.tsx          Slice 1 landing
    error.tsx         route error boundary
    global-error.tsx  root error boundary
    loading.tsx       loading boundary
    not-found.tsx     404
    health/route.ts   build/runtime metadata (commit, build time)
  components/
    NavFrame.tsx      top-level navigation frame (labels only)
  lib/
    env.ts            zod-validated NEXT_PUBLIC_* config (consumed in Slice 2)
  styles/
    tokens.css        design tokens extracted from the recovered app
    globals.css       resets + base element styles
```

## Environment

Public runtime config is validated in `src/lib/env.ts` against
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`NEXT_PUBLIC_FN_BASE`. Only `NEXT_PUBLIC_*` values belong in the browser
bundle; service-role keys and other secrets stay server-side (Slice 2+).
Slice 1 ships and tests the validator but does not call it from any rendered
route, so the shell builds without these variables set.
