# Testimony Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the WHEALTHY Testimony Wall (`#testimonyView`) featuring a rolling 11 ranked "Most Carried" grid, a chronological "Every Answer" river, deep-linked posts pinning, and parallelized database queries for amens.

**Architecture:** Update `/wall-read` to query and populate `has_amened` and `prays_remaining_today` on boot using batched SQL queries. Add the `#testimonyView` markup, CSS styling, and logic in `index.html` to load cards and support debounced idempotent amening.

**Tech Stack:** Vanilla JavaScript, HTML5, CSS3, Supabase JS, Edge Functions.

---

### Task 1: Update `wall-read` Edge Function to Batch Query Viewer State
**Files:**
- Modify: `supabase/functions/wall-read/index.ts:50-180`

- [ ] **Step 1: Write the updated parallel querying code**
  Modify `supabase/functions/wall-read/index.ts` to perform Approach A for batched viewer queries:
  ```typescript
      let postsList: any[] = [];

      // Fetch viewer state (prays and amens) in parallel after posts are loaded
      const fetchViewerState = async (posts: any[], viewer_id: any) => {
        if (!posts || posts.length === 0 || !viewer_id) return { praysMap: {}, amensMap: {} };

        const postIds = posts.map(p => p.id);
        const hasLive = posts.some(p => p.status === 'live');
        const hasAnswered = posts.some(p => p.status === 'answered');

        const queries: Promise<any>[] = [];
        let praysPromiseIndex = -1;
        let amensPromiseIndex = -1;

        if (hasLive) {
          praysPromiseIndex = queries.length;
          queries.push(
            SB.from("wall_prays")
              .select("post_id")
              .eq("member_id", viewer_id)
              .in("post_id", postIds)
              .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          );
        }

        if (hasAnswered) {
          amensPromiseIndex = queries.length;
          queries.push(
            SB.from("wall_amens")
              .select("post_id")
              .eq("member_id", viewer_id)
              .in("post_id", postIds)
          );
        }

        const results = await Promise.all(queries);

        const praysMap: Record<string, number> = {};
        if (praysPromiseIndex !== -1) {
          const { data: userPrays } = results[praysPromiseIndex];
          (userPrays || []).forEach((wp: any) => {
            praysMap[wp.post_id] = (praysMap[wp.post_id] || 0) + 1;
          });
        }

        const amensMap: Record<string, boolean> = {};
        if (amensPromiseIndex !== -1) {
          const { data: userAmens } = results[amensPromiseIndex];
          (userAmens || []).forEach((wa: any) => {
            amensMap[wa.post_id] = true;
          });
        }

        return { praysMap, amensMap };
      };
  ```

- [ ] **Step 2: Update `serializePost` to accept the batched maps**
  Modify the `serializePost` helper in `/wall-read/index.ts` to read from `praysMap` and `amensMap`:
  ```typescript
      const serializePost = (post: any, viewer_member_id: any, praysMap: Record<string, number> = {}, amensMap: Record<string, boolean> = {}, isBibleView = false) => {
        const author_name = post.author_name || post.author?.[0]?.name || post.author?.name || null;
        const author_avatar_url = post.author_avatar_url || post.author?.[0]?.avatar_url || post.author?.avatar_url || null;
        const praysToday = praysMap[post.id] || 0;

        const base: any = {
          id: post.id,
          body: post.body,
          status: post.status,
          pray_count: post.pray_count,
          amen_count: post.amen_count,
          created_at: post.created_at,
          answered_at: post.answered_at,
          answered_note: post.answered_note,
          display_mode: post.display_mode,
          is_mine: String(post.member_id) === String(viewer_member_id),
          pray_count_frozen: post.status === 'answered',
          prays_remaining_today: Math.max(0, 3 - praysToday)
        };

        if (post.display_mode === 'signed') {
          base.author = { 
            name: author_name || 'Steward', 
            avatar_url: author_avatar_url 
          };
        } else {
          base.author = { name: "A Steward", avatar_url: null };
        }

        if (post.status === 'answered') {
          base.has_amened = !!amensMap[post.id];
        }

        if (isBibleView) {
          if (base.author) delete base.author.avatar_url;
          delete base.pray_count;
        }

        if (post.has_unseen_answer !== undefined) {
          base.has_unseen_answer = post.has_unseen_answer;
        }

        return base;
      };
  ```

- [ ] **Step 3: Update all view-query branches to execute `fetchViewerState` and serialize**
  Update the main handler in `wall-read/index.ts` to call `fetchViewerState` for each route:
  ```typescript
      // After loading data inside the conditional view blocks:
      const { praysMap, amensMap } = await fetchViewerState(rawPosts, member_id);
      postsList = (rawPosts || []).map(p => serializePost(p, member_id, praysMap, amensMap));
  ```

- [ ] **Step 4: Deploy and verify local compilation**
  Run: `supabase functions deploy wall-read --project-ref yzaxzmuuvozonhgwhlim`
  Expected: Successful deployment with no TypeScript errors.

---

### Task 2: Insert Sidebar Navigation and View Routing Hooks
**Files:**
- Modify: `index.html:1620-1630`, `index.html:7520-7560`, `index.html:10410-10440`

- [ ] **Step 1: Add sidebar nav entry**
  Insert the Testimony button in the sidebar nav directly beneath `navWall` (around line 1621):
  ```html
  <button class="sidebar-item" id="navTestimony" data-nav="testimony" onclick="go('testimony',this)"><span class="si-dot"></span> Testimony Wall</button>
  ```

- [ ] **Step 2: Add routing to `go()` function**
  Modify `go()` to register `'testimonyView'` inside the array of elements to hide, and map `'testimony'` to `'testimonyView'`:
  ```javascript
  ['dashView','recordView','fastView','bibleView','affiliateView','communityView','leaderboardView','claimView','portalView','tryallView','wallView','testimonyView'].forEach(id=>{const v=document.getElementById(id);if(v)v.style.display='none';});
  const map={dash:'dashView',record:'recordView',fast:'fastView',bible:'bibleView',affiliate:'affiliateView',community:'communityView',leaderboard:'leaderboardView',claim:'claimView',portal:'portalView',tryall:'tryallView',wall:'wallView',testimony:'testimonyView'};
  ```
  And trigger initialization inside `go()`:
  ```javascript
  if(view==='testimony'){
    document.getElementById('headerLine').textContent='Testimony Wall';
    if(typeof initTestimonyWall==='function') initTestimonyWall();
  }
  ```

- [ ] **Step 3: Extend the boot-time deep-link route parser**
  Update the deep-link block (around line 10417) to catch `bootView === 'testimony'`:
  ```javascript
  if (bootView === 'wall') {
    const el = document.getElementById('navWall');
    go('wall', el);
    if (bootPost && window.WALL && typeof window.WALL.openSharedPost === 'function') {
      window.WALL.openSharedPost(bootPost);
    }
  } else if (bootView === 'testimony') {
    const el = document.getElementById('navTestimony');
    go('testimony', el);
    if (bootPost && window.TESTIMONY && typeof window.TESTIMONY.openSharedPost === 'function') {
      window.TESTIMONY.openSharedPost(bootPost);
    }
  }
  ```
  Add `testimony: 'navTestimony'` to the `btnMap` list.

---

### Task 3: Implement Testimony Wall View Container Layout and Styling
**Files:**
- Modify: `index.html:4516-4517`

- [ ] **Step 1: Write `#testimonyView` HTML structure**
  Add the container layout before the Product Portal block:
  *(See Testimony style overrides and elements inside specs/2026-07-16-testimony-wall-design.md or implementation_plan.md)*

---

### Task 4: Implement Testimony JS Controller & Card Rendering
**Files:**
- Modify: `index.html:4516-4517`

- [ ] **Step 1: Write the `TESTIMONY` Javascript controller inside `#testimonyView`**
  *(See Testimony script details inside specs/2026-07-16-testimony-wall-design.md or implementation_plan.md)*

---

### Task 5: Make Reveal Modal Support Testimony Handoff
**Files:**
- Modify: `index.html:4230-4282`

- [ ] **Step 1: Update `openRevealModal` and `revealExit` inside `index.html` to support updating cards and links based on `revealContext` ('wall' vs 'testimony')**

---

### Task 6: Verify Page 3 Implementation
**Files:**
- Create: `whealthy-command-center-repo/test_ui_testimony.js`

- [ ] **Step 1: Run verification script**
  Run: `node whealthy-command-center-repo/test_ui_testimony.js`
  Expected: PASS
