# Slice 2 Implementation Plan — Authentication and Session Boundary

Date: 2026-07-22\
Branch: `next-migration` (from tag `production-baseline-2026-07-21`)\
Status: DRAFT, awaiting approval

## Objective

Give the Next.js app a real, secure authentication and session layer, and reproduce the live app's access gates (Skool-exclusive membership, registration approval, tour) on top of it. No feature pages migrate in this slice; this is the boundary every later slice sits behind. Nothing deploys to production.

## How the live app gates access today (the behavior to preserve)

- Membership is by email against `approved_members`. `onboarding-state?email=` returns a single `gate` value that drives everything: `join` (not a member), `pending` (requested, awaiting admin approval), `quiz` (member, no archetype yet), `bundle` (quiz done, no bundle), `ready`. Plus `verified` (in roster, active, not banned), the Skool URL, discount, and the `exclusive` flag.
- New people are not auto-added. They `request-access`; an admin approves them in the Surface tab (`admin-registrations`) before they join the roster. Approval copy says up to 24 hours.
- The tour runs once per member, tracked by `approved_members.tour_done_at`; `tour-state` writes it behind a Supabase JWT.
- Admins are gated by `approved_members.admin_role` (`master` | `admin` | `moderator` | null), enforced server-side. `ignacio@thebizcofirm.com` is the only `master`.

## The security target (from the migration rules)

- Sessions validated server-side with `getUser()`, never trusting user-editable `user_metadata` for authorization.
- Supabase SSR with secure, httpOnly cookies. Anon key only in the browser; service-role never leaves the server.
- RLS remains the final row-level enforcement layer.
- Login method: OTP (emailed one-time code / magic link), per the approved handoff. This is a deliberate upgrade from the live app's email-based gate: instead of typing an email that anyone could enter, a member proves control of that email once, and the app derives their identity from the verified session rather than from a value they typed. Pending your confirmation (see decision below).

## Approach

1. Supabase clients: a browser client and an SSR/server client using `@supabase/ssr`, cookie-based, reading the validated `NEXT_PUBLIC_*` config from `src/lib/env.ts` (built in Slice 1). Add a server-only helper that calls `getUser()` and returns the authenticated email, never derived from client input.
2. OTP login flow: a sign-in route where a member enters their email, receives a one-time code / magic link, and lands back with a session. Before granting entry, call `onboarding-state` for the verified email and branch on `gate`.
3. Gate reproduction (server-side): render the right next step for each `gate` value, faithful to the live copy:
   - `join` → the Stewards community popup (Skool CTA + "already joined? request access").
   - `pending` → "You're on the list" (24-hour message from the API, not hardcoded).
   - `quiz` / `bundle` / `ready` → route the member onward (the destination pages are placeholders until their slices; this slice proves the gate decision and redirect, not the page).
   - `request-access` wired to the join popup's request path.
4. Route protection: a server-side guard (middleware + per-route checks) that redirects unauthenticated or non-member visitors to sign-in / the appropriate gate. Protected shell vs public sign-in clearly separated.
5. Logout: clears the session cookie and returns to sign-in.
6. Admin: read `admin_role` server-side from the session's email for later admin routes, but do NOT build admin authorization enforcement in this slice (the handoff defers it until the source-of-truth fields are confirmed in-app; the field is `approved_members.admin_role`, which we will confirm against live before Slice 8). This slice only establishes that the session can be resolved to a role server-side.

## Environment variables (needed for this slice)

The Slice 1 build needed none; Slice 2 consumes `src/lib/env.ts`, so the `whealthy-next` Vercel project needs three PUBLIC values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FN_BASE`. These are the anon/publishable values that already ship in the live browser bundle, so they are not secrets. No service-role key is added anywhere. I can pull the correct URL and anon key from the Supabase connector and give you the exact three values to paste into the Vercel project settings (or add them myself if the tooling allows).

## Testing and gates

- All four Slice 1 gates stay green (lint, typecheck, vitest, build).
- New unit tests: the gate-branching logic (`join`/`pending`/`quiz`/`bundle`/`ready` → correct destination) and the server-side session-to-email/role resolver, with valid and forged inputs (a forged `user_metadata` role must not grant access).
- Preview verification on `whealthy-next`: sign-in with OTP reaches a session; a non-member email lands on the join gate; a pending email shows the pending state; logout clears the session. Verified against the live `onboarding-state` behavior.
- Recovery gates re-run at the slice head; production confirmed untouched.

## Out of scope

The quiz, bundle, dashboard, and every feature page (their own slices); admin authorization enforcement (Slice 8); migrating the edge functions themselves (their contracts stay stable). This slice stops at "the right person reaches the right gate with a real, server-validated session."

## Open decisions (need your call)

1. Login method for members: OTP emailed code / magic link (the approved handoff choice, and the more secure one) vs. matching the live app's current email + password. Recommendation: OTP.
2. Whether I add the three public env values to the Vercel project myself (if tooling permits) or hand them to you to paste.

## Rollback

Additive on `next-migration`; reset to the prior commit. Production has no dependency on any of it.
