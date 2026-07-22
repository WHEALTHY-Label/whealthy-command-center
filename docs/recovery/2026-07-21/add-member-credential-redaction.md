# Nurture webhook credential redactions

During production source recovery on 2026-07-21, one shared nurture webhook credential was found embedded across seven deployed functions. The recovered source deliberately replaces every copy with `Deno.env.get('NURTURE_WEBHOOK_SECRET')`:

- `add-member`
- `cancel-nurture-sequence`
- `crm-health`
- `member-onboarding-check`
- `send-nurture-email`
- `skool-sync`
- `trigger-nurture-sequence`

Each affected authentication, comparison, or outbound header action now fails closed when `NURTURE_WEBHOOK_SECRET` is absent. Before any future deployment of any listed function, rotate the prior production webhook credential and configure its replacement as the `NURTURE_WEBHOOK_SECRET` Edge Function secret. Do not restore a credential literal to source control.

## Branch-history attestation

Run `node tools/recovery/scan-history-secrets.mjs` before publication. The attestation intentionally scans every blob reachable from the current branch's `HEAD` and does not scan other local or quarantine refs. Four exact documentation/test-fixture paths are scanned but allowlisted from findings: `docs/CHANGELOG-2026-07-13.md`, the Slice 0 recovery plan, and the two secret-scanner test files. No production source path is allowlisted.

Publish only the reviewed branch with an explicit refspec such as `git push origin HEAD:refs/heads/recovery/production-baseline-2026-07-21`; do not use `--all`, `--mirror`, or push quarantine tags.
