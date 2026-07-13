# WHEALTHY Command Center

The member application for the WHEALTHY Stewards community. A faith-rooted performance governance app: voice-first journaling (The Record), a scripture-rooted fast builder (The Fast), the Bible 365 reading tracker, leaderboard, affiliate tools, and the Governor, a floating voice command layer that navigates and operates the whole app.

Live at: https://whealthylabel.com/command-center (deployed as an HTML code embed on baknd.io)

## Architecture

Single-file application: `index.html` contains all markup, styles, and scripts. No build step. It talks to Supabase Edge Functions only; no keys or service credentials exist in the page.

```
index.html (baknd embed)
  |-- login gate ---------------> governor-state (member validation, action: load)
  |-- The Record / The Fast ----> governor-state (save_entry, save_fast, save_kept, ...)
  |-- Governor voice layer -----> governor-ai (intent_router + generation tasks)
  |-- Bible 365 ----------------> bible-api.com (verse text; fixed reference library only)
  |-- Leaderboard --------------> get-leaderboard / get-leaderboard-names
```

Supabase project: `yzaxzmuuvozonhgwhlim`

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | The entire Command Center application |
| `supabase/functions/governor-ai/` | AI gateway. Holds the Anthropic key server-side, enforces the Language Constitution, validates output (banned words, em dashes, scripture whitelist), rate-limits per email |
| `supabase/functions/governor-state/` | All state persistence: record entries, fasts, fast days, prefs, member profile, 8:45 PM report gate (server-enforced) |
| `supabase/functions/get-leaderboard/` | Leaderboard RPC wrapper |
| `supabase/functions/get-leaderboard-names/` | Leaderboard display names |
| `supabase/functions/verify-member/` | Membership check returning member_status (lead / member / left) |
| `docs/CHANGELOG-2026-07-13.md` | Full change log of the freemium migration and Command Center fixes |

## The Governor (voice command layer)

The floating mic is the identity of the application. It opens a compact corner panel, listens, transcribes, and executes on stop:

- Navigation: "take me to the fast", "open my record"
- Record queries: read back entries, threads, when-last lookups
- Fast: status, today's directive, mark tonight's report
- Scripture: read a reference, find by theme (fixed library only, never generated verse text)
- Journaling: only when the words ARE an entry, the router classifies and files it
- Guarded intents (burn entry, start/end fast, claim, invites) always require physical confirmation

The record page mic remains a dedicated journaling mic.

## Deploying

**The page:** paste `index.html` in full into the baknd page embed for /command-center, publish, hard refresh.

**Edge functions:** `supabase functions deploy <name> --no-verify-jwt` for each function directory.

**Required Supabase secrets** (Dashboard → Edge Functions → Secrets):

| Secret | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | governor-ai |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | all functions (auto-provisioned) |

## Engineering rules (hard-won, do not regress)

1. No keys in the page, ever. Pages call edge functions; functions hold the service role.
2. The supabase-js CDN script must load WITHOUT `defer` (inline scripts depend on the global at parse time). The client init is null-safe if the CDN fails.
3. No `confirm()` dialogs: browsers silently block them inside cross-origin iframes (how baknd embeds this page). Use two-tap or hold-to-confirm patterns.
4. All localStorage access goes through the `__lsGet/__lsSet/__lsDel` helpers (sandboxed embeds can block storage; boot must never die).
5. Overlays that must cover baknd's page chrome need z-index above ~2.1 billion (baknd's own footer stack is high).
6. Structural CSS selectors (`body>*`) break inside baknd wrappers; target elements by name.
7. Scripture text is never AI-generated. References come from the fixed library; verse text from the Bible API.
8. Brand Language Constitution is enforced server-side in governor-ai, with a banned-word regex as the last line of defense.

## License

Proprietary. Copyright (c) 2026 WHEALTHY Label. All rights reserved.
