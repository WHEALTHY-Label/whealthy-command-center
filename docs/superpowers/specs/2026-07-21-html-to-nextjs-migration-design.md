# WHEALTHY HTML-to-Next.js Migration Design

**Date:** 2026-07-21  
**Status:** Approved design  
**Production application:** `thestewardsrhythm.com`  
**Migration application:** `next.thestewardsrhythm.com`

## Purpose

Migrate the WHEALTHY member application from its monolithic HTML, CSS, and JavaScript implementation to a maintainable Next.js App Router application without interrupting the current production experience or losing recently deployed functionality.

The migration will improve the interface and navigation while preserving product behavior, data, language constraints, and member workflows. It will use a temporary subdomain, independently deployable vertical slices, server-verifiable identity, measurable parity checks, and immediate legacy fallbacks.

## Current State

The application is a static, single-page system whose primary `index.html` is approximately 20,000 lines. It uses hash-addressed views, browser-managed state, Supabase Edge Functions, and a Supabase database. The current repository README describes a smaller historical architecture and does not reflect the full deployed member application.

GitHub `main` currently ends at commit `aa706bc`, while Vercel production includes later Rhythm, onboarding, layout, analytics, and order-tracking releases. Several of those deployments were produced from a dirty working tree. The live production HTML is also larger than the repository version. Therefore, the repository cannot yet be treated as the production source of truth.

## Goals

- Establish a reproducible production baseline in GitHub before migration.
- Keep the current production application operational throughout the migration.
- Introduce a redesigned, responsive, accessible Next.js interface.
- Replace browser-supplied email identity with authenticated email OTP sessions.
- Preserve Supabase as the system of record.
- Reuse deployed Edge Functions through typed adapters before considering backend movement.
- Migrate one complete user capability at a time.
- Make every release observable and independently reversible.
- Switch the primary domain only after feature parity and rollback verification.

## Non-Goals

- A simultaneous frontend, database, and Edge Function rewrite.
- Mechanical conversion of the existing HTML into one large React Client Component.
- Destructive schema cleanup while legacy and Next.js applications coexist.
- Pixel-for-pixel reproduction of the current interface.
- Replacing the product's language constitution or generating scripture with AI.
- Moving privileged operations into browser code.

## Selected Strategy

Use a strangler migration on a temporary subdomain.

The existing Vercel project and primary domain remain unchanged. A self-contained Next.js App Router application will be added under `apps/web` and deployed as a separate Vercel project at `next.thestewardsrhythm.com`. Migrated features will run natively in Next.js; unfinished features will link securely to their legacy equivalents.

This approach was selected over two alternatives:

- Rebuilding the entire application before launch would delay feedback and concentrate cutover risk.
- Mechanically wrapping the existing page in React would preserve the monolith and provide little architectural benefit.

## Slice 0: Production Source-of-Truth Recovery

Slice 0 is mandatory and precedes all Next.js work.

It will:

1. Capture the exact live production HTML and static assets.
2. Diff the live application against GitHub `main`.
3. Compare every deployed Supabase Edge Function with its repository version.
4. Reconcile Supabase migrations and current schema state.
5. Inventory Vercel and Supabase configuration without recording secret values.
6. Exercise the recovered application with existing and expanded smoke tests.
7. Commit the reconciled source to a protected recovery branch.
8. Tag the verified baseline and record a release manifest.

The release manifest will connect the Git commit, Vercel deployment, Supabase migration state, Edge Function versions, environment-variable names, and smoke-test results.

No production behavior will be intentionally changed during recovery.

## Target Repository Structure

The legacy application remains in its existing locations during coexistence. The new application is isolated from the legacy deployment configuration.

```text
repository/
├── apps/
│   └── web/                  # Next.js App Router application
├── supabase/
│   ├── functions/            # Existing Edge Functions
│   └── migrations/           # Backward-compatible migrations
├── docs/
│   └── superpowers/
├── index.html                # Existing production application during migration
└── legacy HTML entry points
```

The first Next.js deployment will not require the existing Vercel project to change its framework detection, root directory, or build command.

## Next.js Architecture

The new application will use App Router and Server Components by default. Client Components will be limited to browser-only interaction, optimistic controls, forms, timelines, media capture, and other stateful experiences.

The application will provide:

- Public, member, and administrative route groups with separate layouts.
- Server-rendered initial states where practical.
- Typed application services around Edge Functions and Supabase queries.
- Route-level loading, empty, error, unauthorized, and not-found states.
- Server-side feature flags marking capabilities as `next`, `legacy`, or `disabled`.
- A consistent design-token and component system.
- Structured telemetry for navigation, requests, errors, and fallback use.

UI components will not call arbitrary Supabase tables or construct raw Edge Function requests. They will depend on bounded application services whose inputs and outputs are validated.

## Identity and Authorization

The Next.js application will replace browser-supplied email identity with Supabase Auth email OTP.

The sign-in sequence is:

1. A member submits an email address.
2. Supabase sends a one-time code.
3. The server verifies the code and establishes an HttpOnly Supabase session.
4. The application matches the authenticated email to `approved_members`.
5. Server-side authorization enforces membership status, tier, and administrative role.
6. Sensitive operations independently validate both identity and resource ownership.

Authorization will not rely on user-editable metadata. Administrative authorization must use trusted database state or server-managed app metadata. Service-role credentials remain server-only.

During coexistence, legacy navigation will use a short-lived, signed handoff mechanism. The token will be single-purpose, expire quickly, contain no service credentials, and be verified by a server-controlled endpoint before establishing legacy context. If a secure handoff cannot be implemented without weakening identity, the user will be asked to authenticate again instead.

## Data Flow

Each migrated capability will use the following boundary:

```text
Route or Component
  -> Typed application service
  -> Next.js server operation or existing Edge Function
  -> Supabase
  -> Validated response contract
  -> UI
```

Existing Edge Functions remain authoritative initially. A function may move into a Next.js server operation only after a separate review confirms that doing so simplifies ownership, preserves security boundaries, and does not break the legacy application.

Database changes made during coexistence must be additive and backward-compatible. Columns, functions, and tables used by the legacy application cannot be renamed or removed until final retirement.

## Migration Slices

Every slice is a complete vertical capability containing routes, UI, identity and authorization behavior, data adapters, automated tests, telemetry, acceptance criteria, and rollback behavior.

### Slice 1: Foundation and Identity

- Next.js project and isolated Vercel deployment
- Design system, navigation, responsive shell, and metadata
- Email OTP sign-in and session handling
- Member, tier, and administrative gates
- Feature registry and legacy fallback behavior
- Signed legacy handoff or explicit reauthentication fallback
- Error boundaries and baseline observability

### Slice 2: Dashboard Home

- Member overview and current status
- First steps and recent activity
- Quick actions and feature availability
- Read-only server-side aggregation
- Links to legacy implementations for unfinished tools

### Slice 3: The Steward's Rhythm

- Assessment and intake
- Plan generation and draft review
- Slot editing, explanation, and reordering
- Activation, daily timeline, and check-ins
- Nudges, seasons, fresh starts, and calendar behavior
- Administrative Rhythm statistics

### Slice 4: Bible Experience

- My Bible reading state
- Progress, marks, and reflections
- Scripture delivery and fixed-source verse retrieval
- Bible Buddy
- Existing scripture integrity and language constraints

### Slice 5: Prayer and Community

- Prayer Wall and Testimony Wall
- My Prayers
- Pray, amen, answer, report, and moderation workflows
- Member display profiles
- Skool feed integration

### Slice 6: Disciplines and Accountability

- The Record and journaling
- The Fast and daily discipline state
- Challenges and cohorts
- Steward Circles
- Streaks and leaderboards
- Governor interactions required by these capabilities

### Slice 7: Commerce and Products

- Product portal and owned products
- Subscriptions and bundles
- Purchase history
- Shopify order synchronization
- Fulfillment and shipment tracking

### Slice 8: Onboarding and Membership

- Registration approval and pending states
- Product tour and first steps
- Invitations and membership tiers
- Skool membership synchronization
- Onboarding and transactional email flows

### Slice 9: Administration

- Control panel
- Member and registration management
- Settings and administrative roles
- Analytics and CRM health
- Audit history
- Content moderation
- Cross-product operational reporting

## Slice Acceptance Contract

No slice is complete until it includes:

- Loading, empty, error, unauthorized, and degraded states.
- Mobile and desktop behavior.
- Keyboard navigation and accessible semantics.
- Event and failure telemetry.
- Contract tests for each backend dependency.
- Authorization coverage for anonymous, member, premium, moderator, admin, and master contexts as applicable.
- A tested legacy fallback or server-side disable switch.
- Written acceptance criteria and verification evidence.
- Confirmation that existing production data was not unintentionally modified.

No slice may depend on an unfinished later slice. Shared functionality must either be part of Slice 1 or remain behind a stable adapter.

## Environment and Release Flow

Each slice advances through four stages:

1. Local development using a Supabase branch or deterministic test fixtures.
2. A Vercel preview deployment.
3. `next.thestewardsrhythm.com` access for an initial cohort of 5–10 test members for at least 48 hours.
4. General member availability after acceptance.

Production mutation testing will use synthetic accounts and explicitly tagged records when an isolated Supabase branch cannot reproduce the required integration.

## Verification Strategy

Each slice will have proportionate coverage across:

- Unit tests for validation, authorization, transformations, and state machines.
- Contract tests for Supabase tables, RPCs, and Edge Functions.
- Playwright coverage of primary journeys and failure paths.
- Visual comparisons at 360, 400, 430, 768, and 1440 CSS pixels.
- Automated accessibility checks and keyboard walkthroughs.
- Tests for anonymous, member, tiered, and administrative access.
- Performance budgets targeting p75 LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1 on the migration domain.
- Observability checks for client exceptions, failed requests, unexpected redirects, and legacy fallback frequency.

A slice cannot be broadly enabled until its rollback path has been rehearsed.

## Failure Handling and Rollback

Feature selection occurs server-side. A failing Next.js feature can be returned to its legacy route without a new application deployment.

Every server operation will distinguish validation, authentication, authorization, dependency, rate-limit, and unexpected failures. User-facing errors will avoid exposing internal details and will provide a recoverable next action where possible. Sensitive values and member content will not be written to client logs.

The legacy application remains deployable at a private rollback hostname for at least 14 days after the primary-domain switch.

## Final Cutover

The primary domain will switch to the Next.js Vercel project only when:

- All nine slices meet their acceptance contracts.
- No active navigation path depends on a legacy feature.
- Production telemetry remains below a 1% unexpected application-error rate and within the stated performance budgets for seven consecutive days.
- Database and Edge Function compatibility has been verified.
- Accessibility and performance audits pass.
- The domain-switch and rollback procedures have both been rehearsed.
- A final release manifest has been recorded.

After the observation window, the legacy code will be archived with its final deployment manifest. Destructive schema cleanup and Edge Function retirement will be planned separately.

## Primary Risks and Controls

| Risk | Control |
|---|---|
| GitHub is behind production | Mandatory Slice 0 recovery and tagged baseline |
| Migration omits hidden hash-route behavior | Route inventory plus parity and Playwright coverage |
| Authentication change locks out members | Test cohort, OTP delivery monitoring, and legacy fallback |
| New code bypasses RLS or trusts email input | Server-verifiable sessions, ownership checks, and authorization tests |
| Legacy and Next.js schemas diverge | Additive migrations and typed adapters |
| Visual redesign changes product semantics | Behavioral acceptance criteria and member testing |
| Dirty deployments recur | Release manifests and Git-backed deployments only |
| A large slice becomes unmanageable | Vertical acceptance contracts and internal component boundaries |

## Completion Definition

The migration is complete when the Next.js application serves the primary domain, all member and administrative workflows pass their acceptance contracts, no normal route depends on the legacy application, rollback has been proven, and the 14-day legacy observation window has completed without requiring rollback.
