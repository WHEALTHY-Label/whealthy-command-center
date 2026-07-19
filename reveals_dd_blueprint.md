# Reveals page — cold-traffic rebuild (Digital Degens FORMAT, WHEALTHY content) — Antigravity build spec

_July 19, 2026. Ignacio approved the mockup (delivered in chat as reveals_dd_mockup.html — use it as the visual reference). Rule from Ignacio: use the Digital Degens FORMAT, not its content. Every existing dynamic token and line of reveals copy stays. Applies to the results render in BOTH `whealthy-quiz.html` and `whealthy-home.html` (same renderer). Must stay dynamically mobile responsive (project rule)._

## What the format adds (the persuasion skeleton)
Value-anchoring and price repeated at every scroll depth, proof interleaved between the story sections, and a persistent decision bar. The existing S1-S9 story is NOT rewritten; new blocks are inserted between existing ones.

## Final section order (existing blocks unchanged unless marked NEW/MODIFY)
1. **S1 identity hero** — unchanged. `${ip.season}`, `${nameStr}` (keeps its no-name fallback for cold traffic), `${ip.profile.name}`, carryLine, subtitle, honor.
2. **NEW · Proof stat bar** — 3 stats directly under S1, derived from `bp` (never hardcoded): `money(bp.retail)` "value in your matched routine" · `money(bp.member)`/mo "your member price · 10% off" · `money(bp.retail - bp.member)` "under buying it the old way".
3. **S2 pattern** — unchanged (`${d.n[0]} ${d.n[1]}`, `${d.sig}`, willpower card `${d.pat}`).
4. **NEW · Testimonial band** — full-width lime background, dark text, big Oswald quote. Content = the existing archetype-matched `PROOF_MAP` quote for `${archKey}` (map lives in index.html's claim flow; copy it into the landing files or hoist it shared like BUNDLE_PRICES). Attribution: name · role · "same pattern".
5. **Steward turn** (existing, steward fork only).
6. **S3 shame** — unchanged (`${ip.citation}`, `${d.shame}`).
7. **S4 cost** — unchanged `${costSection}`, then **NEW price anchor line** right under it: "Your governed routine, as a member: **money(bp.member)/mo** ~~money(bp.tryPrice) non-member~~" + one `Join Free · Get 10% Off` button.
8. **S5 governance** — unchanged.
9. **S6 routine** — unchanged (bridge, timeline, bundle tiles), then **MODIFY `resultsPriceBlock`: SIMPLIFY to 2 numbers**. Ignacio found 3 numbers confusing. Remove the `results-price__rows` 3-line comparison entirely. Keep: label "Your member price" → hero `money(bp.member)`/mo → "Non-members pay ~~money(bp.tryPrice)/mo~~. Join the Stewards free to unlock your 10% code." → foot "+ $9.95 flat shipping · billed monthly · cancel anytime". (The $84.98 retail anchor now lives in the stat bar and value stack instead.)
10. **NEW · Review videos** — section "REAL STEWARDS. REAL REVIEWS." Two vertical 9:16 video slots (Shorts format), one per product of the CURRENT bundle, side by side on desktop, stacked on mobile. Drive from a config so it stays dynamic per bundle:
    ```js
    const REVIEW_VIDEOS = {
      'Charge Powder': 'https://www.youtube.com/embed/nPEV9WZCc2s', // real member review (Ignacio, Jul 19)
      // 'Hydration Powder': '<embed URL when Ignacio sends it>'
    };
    ```
    For each `bundle.products` product: if `REVIEW_VIDEOS[p.name]` exists render an `<iframe>` embed (allowfullscreen, loading="lazy", solid lime-tinted border); else render the dashed placeholder (play icon + "Video placeholder" + "Real member review video — to be added"). Shorts embed URL form: `https://www.youtube.com/embed/<id>`.
11. **NEW · Value stack** — "EVERYTHING YOU'RE GETTING / MORE THAN A ROUTINE". Rows: matched routine `${cfg.name}` shipped monthly → `money(bp.retail)`; governance system (archetype, daily directives, the app) → "Included"; The Stewards community → "Free forever"; the disciplines → "Included". Total row: ~~money(bp.retail)+~~ → lime `money(bp.member)`/mo. Do NOT invent dollar values for the included items (only bp.retail is a real number). CTAs under it: `Join Free · money(bp.member)/mo · 10% Off` (lime) + `Buy the Bundle · money(bp.tryPrice)/mo` (ghost).
12. **NEW · Who it's for** — "BUILT FOR THE ONES WHO CARRY", yes/skip two columns, static copy from the mockup.
13. **S7 decision** — unchanged (already shows both prices; keep steward/customer forks).
14. **S8 stewards** — unchanged.
15. **S9 final** — unchanged.
16. **NEW · Sticky bottom decision bar** — fixed, two buttons: `Buy the Bundle · money(bp.tryPrice)/mo` (lime bg) + `Join Free · money(bp.member)/mo` (dark bg, lime text). Steward fork shows both; customer fork shows Buy only. Appears after the user scrolls past S2 (not instantly), sits under the quiz-modal close button z-index, and add bottom padding to the result container so it never covers S9/retake/legal. On mobile keep both buttons on one row, smaller type.

## Forks and personalization (unchanged behavior, verify after restructure)
- Steward vs customer fork gates: testimonial band(keep for both), decision paths, sticky bar contents, community block — same logic as today.
- All tokens keep working: `${nameStr}`, `${ip.*}`, `${d.*}`, `${cfg.name}`, `${bundle.*}`, `bp` per `bundleKey`, `${window._affiliateName}`.
- Prices must ALWAYS come from the shared `BUNDLE_PRICES` + `money()` (hoisted in commit 658ec86). Zero hardcoded dollar strings in the new blocks except the $9.95 shipping line and the $240/mo "old way" costs already in S4's copy.

## Verification Antigravity should ship with
Extend `test_ui_results_pricing.js` (or new test): stat bar shows bp-derived numbers for two different bundles; simplified price block has NO `results-price__rows`; review section renders 1 iframe + 1 placeholder for charge bundle; sticky bar appears on scroll and buttons carry the right prices; all existing regression tests still pass.

## Assets
- Charge Powder review video (real): https://youtube.com/shorts/nPEV9WZCc2s → embed `https://www.youtube.com/embed/nPEV9WZCc2s`.
- Hydration Powder review video: PENDING from Ignacio — placeholder until then.
