# WHEALTHY Production Recovery — 2026-07-21

## Outcome

This immutable recovery baseline records 1,032,340 bytes of production HTML with SHA-256 `b26274c35f862d67f49409e593af81b90a7db273446fe4fd1e3888a734dff1c3`, 81 deployed Edge Function records, and 46 remote migration-ledger records. The captured Vercel deployment is `dpl_AEjt6dY2YzmSWrxSnTofERBH7SWm` (READY production) and is the deployment currently mapped to both `thestewardsrhythm.com` and `www.thestewardsrhythm.com`.

## Source Drift Reconciled

74 deployed Edge Functions are byte-exact captures. Seven functions are intentionally credential-redacted because production shared one embedded nurture webhook credential: `add-member`, `cancel-nurture-sequence`, `crm-health`, `member-onboarding-check`, `send-nurture-email`, `skool-sync`, `trigger-nurture-sequence`. Their recovered source uses `NURTURE_WEBHOOK_SECRET` and fails closed when that secret is absent; the reasons are recorded per function in the manifest and summarized in `docs/recovery/2026-07-21/add-member-credential-redaction.md`. Before any deployment of any listed function, rotate the prior nurture webhook credential and configure the replacement as the `NURTURE_WEBHOOK_SECRET` Edge Function secret. These are intentional safety boundaries, not omitted captures.

The remote migration ledger has 46 historical migration sources unavailable in this checkout. Their current-state representation is the catalog-derived, SELECT-only schema snapshot at `supabase/baseline/2026-07-21-public-schema.sql` (SHA-256 `30cf9af589207e1817ba15d5eec02a3051ce475ca3e794e078c490b5bb70127f`). It is explicitly non-replayable and requires human review before any rebuild or migration work.

## Verification

- Read-only smoke tests: 3/3 passed.
- Error-level Supabase security advisor findings: 0.
- Secret scan: passed.
- Branch-history secret scan: pending-history-rebuild. The current branch is expected to fail until the controller rebuilds it without the contaminated intermediate commit; it must pass before publication.
- Edge capture recursive comparison: passed.
- Diff hygiene: run `node tools/recovery/verify-diff-hygiene.mjs`. It permits whitespace findings only in hash-verified, byte-faithful `index.html` and exact-capture Edge Function files; redacted and generated files must remain clean.
- Production deployment target: production; recovery branch: `recovery/production-baseline-2026-07-21`.

No defects were observed by the read-only smoke suite.

## Configuration Inventory

Environment-variable names discovered only from tracked Edge Function source: ANTHROPIC_API_KEY, AUTO_INVITE_ENABLED, BAKND_API_KEY, BAKND_API_URL, BAKND_WEBHOOK_SECRET, INVITE_ZAP_HOOK, NURTURE_WEBHOOK_SECRET, RESEND_API_KEY, RESEND_FROM, SHOPIFY_ACCESS_TOKEN, SHOPIFY_STORE, SHOPIFY_WEBHOOK_SECRET, SKOOL_BOT_COOKIE, SKOOL_GROUP_SLUG, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, ZAPIER_WEBHOOK_SECRET.

No Vercel or Supabase environment values were requested, queried, or recorded.

## Rollback and Review Gate

Pre-recovery Git commit: `aa706bc62fb58e7ce25ccda75381049801bda886`. Captured production deployment: `dpl_AEjt6dY2YzmSWrxSnTofERBH7SWm`. Manifest parent commit: `a58bc2e7a801d078da7ce4f277c99e929ed3097e`.

Slice 1 planning may begin only after this report, the manifest integrity checks, and the recovery diff receive human approval.
