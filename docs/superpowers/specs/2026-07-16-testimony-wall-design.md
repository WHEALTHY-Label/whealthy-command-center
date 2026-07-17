# WHEALTHY Testimony Wall Design Spec (Page 3 of 6)

## Overview
The Testimony Wall (`#testimonyView`) is a permanent ledger of answered prayers. Unlike the rolling, decaying Prayer Wall, this surface only grows, acting as an accumulating record of answered intercessions.

---

## 1. Sidebar Nav & SPA Routing
* **Sidebar Entry**: Insert a new tab button under the Prayer Wall in `index.html`:
  ```html
  <button class="sidebar-item" id="navTestimony" data-nav="testimony" onclick="go('testimony',this)"><span class="si-dot"></span> Testimony Wall</button>
  ```
* **SPA Routing Hook**: Update `go()` to manage `'testimonyView'` visibility, map `'testimony'` to `'testimonyView'`, and trigger `initTestimonyWall()` on navigation.
* **Hash Router Fallback**: Add `'testimony': 'navTestimony'` to the boot-time hash `btnMap` so that direct hash navigation (#testimony) successfully resolves on load.

---

## 2. Deep-Link Handler & Cross-Wall Handoff
* **Parser Integration**: Extend the existing boot-time query-param reader in `DOMContentLoaded` to capture `?view=testimony&post=[id]`.
* **Link Validation Flow (`TESTIMONY.openSharedPost`)**:
  - Fetch the target post from `/wall-read` using `view: 'single', post_id: postId`.
  - **Handoff Logic**:
    - If `status === 'answered'`: Pin the card at the top inside `#tst-pinned`, scroll smoothly, and run a 1-second lime border pulse animation.
    - If `status === 'live'` or `'archived'`: Silently hand off to the Prayer Wall via `?view=wall&post=[id]`, loading the target post inside the `#wall-pinned` container (where archived posts successfully render their specific 30-day message).
    - If `status === 'held'`: Render a message stating "This testimony is under review."
    - If `404`: Render a message stating "This testimony is no longer here."

---

## 3. Parallelized Viewer-State Querying (`/wall-read`)
To eliminate per-card SQL queries and maximize database caching efficacy, we will update the `/wall-read` Edge Function to use batched querying (Approach A):
1. Retrieve the list of posts (`postsList`) matching the current view.
2. Gather all post UUIDs: `const postIds = postsList.map(p => p.id);`.
3. Check what post statuses are present in the list. Run queries in parallel via `Promise.all`:
   - If live posts exist: Fetch count of user's prays in the last 24h for those `postIds` from `wall_prays`.
   - If answered posts exist: Fetch list of `postIds` user has amened from `wall_amens`.
   - Skip either query if no posts in the list require it (e.g. `bible365` skips both; `testimony_river` skips prays).
4. The serializer reads from these batched sets to compute `prays_remaining_today` and `has_amened` cleanly.

---

## 4. Double-Block Card Layout
* **Layout Design**:
  - The card displays the original prayer (`body`) at `rgba(255,255,255,0.60)` under the header `ASKED`.
  - A lime hairline (`rgba(204,255,0,0.20)`) separates the blocks.
  - The answered note (`answered_note`) is displayed at `rgba(255,255,255,0.80)` under the header `ANSWERED`.
  - **No-Note Variant**: If `answered_note` is empty/null, the `ANSWERED` header and block are completely omitted (no empty blocks or placeholders).
* **Metadata Fields**:
  - **Elapsed line**: `Asked [Date] · Answered [Date] · [X] days` (or `Same day`, `1 day`) in DM Sans 12px, lime. (No em dashes or hyphens).
  - **Frozen count**: `Prayed [X] times` in Oswald 700, lime.
* **Amen Button**:
  - **Available**: `AMEN · [count]`, transparent pill with `0.20` lime border.
  - **Has amened**: `✓ AMEN · [count]`, solid lime background, black text. (Tapping this state is a silent no-op).
  - Triggers optimistic increment (+1, changes style to active) and debounced (400ms) POST call to `/wall-amen`. Self-amens are fully allowed.
* **Share Button**: Reuses the existing Reveal Modal to warn about social inference when sharing own anonymous testimonies. Sign-and-share calls `/wall-sign` and replaces the card. The generated share link is `?view=testimony&post=[id]`.
* **Report Button**: CONFIRM flagged state, calls `/wall-report`.

---

## 5. Columns & Responsiveness
* **Rolling 11 Grid**: Fetched via `/wall-read` with `view: 'testimony_top'`. Renders a 2-column grid above 900px, collapsing to 1 column below. Completely hidden if empty.
* **Chronological River**: Fetched via `/wall-read` with `view: 'testimony_river'`. Always 1-column at all screen widths.
* **Mobile Adaptations**:
  - 640px: Container padding drops, amen button expands to full card width.
  - 400px: Author names truncate, elapsed line compresses to short format (e.g. `Mar 4 · Jun 12 · 100d`) to prevent awkward line breaks.
  - `prefers-reduced-motion`: Disables all border/button scale animations and transitions.
