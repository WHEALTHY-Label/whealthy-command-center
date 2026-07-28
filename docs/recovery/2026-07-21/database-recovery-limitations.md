# Database recovery limitations

Captured: 2026-07-22T04:49:14.799Z

- The remote migration ledger contains 46 migrations; no remote migration has a filename-exact local source in this checkout. In particular, `20260722001453_harden_public_schema_rls_and_privileges` is intentionally recorded as `missing`: the exact applied SQL was not available from Git history, the repository, or Supabase read APIs. It was not reconstructed or invented.
- The Supabase CLI linked dump was not retried. Its initial attempt tried to initialize or alter a remote login role and was refused with a permission error. That behavior is outside this read-only recovery boundary.
- `supabase/baseline/2026-07-21-public-schema.sql` is a strict SELECT-only catalog snapshot. It contains no table rows; function bodies are deliberately omitted, while views, functions, triggers, and grants are captured as non-executable metadata where replay would need a deliberate human review.
- A follow-up SELECT-only catalog query verified and recorded every current relation grant: 842 total, comprising 796 grants on base tables and 46 grants on views. No grants were changed.
- Current advisor capture has 0 security errors, 18 security warnings, 0 performance errors, and 0 performance warnings. The GraphQL exposure warnings are retained as review findings; no grants were changed.
- Supabase's 2026 Data API exposure change makes grants and RLS separate controls. Existing tables are unaffected until the platform's existing-project enforcement date, but future public-schema tables need explicit grants if they are intended for Data API use. No grants were altered during recovery. See the official change note: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
