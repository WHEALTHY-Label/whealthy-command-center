# Bible Reflections & Community Prayer Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log Bible reflections privately to a Supabase database table and update the Community Prayer sanctuary task to redirect users to Skool for active community engagement.

**Architecture:** Create a `bible_reflections` table in Supabase, add `load` and `save_reflection` actions in the `governor-state` Edge Function, sync these reflections in `index.html` on day navigation, and add an inline drawer for Skool redirects under Sanctuary Tasks.

**Tech Stack:** HTML/CSS/JS (Vanilla), Supabase Postgres, Deno/TypeScript (Edge Functions).

---

### Task 1: Supabase Database Migration

**Files:**
- Create: `supabase/migrations/20260716000000_create_bible_reflections.sql`

- [ ] **Step 1: Write the migration SQL file**
  Create the migration file `supabase/migrations/20260716000000_create_bible_reflections.sql` with the following schema:
  ```sql
  -- Daily Bible Reflections Table
  CREATE TABLE IF NOT EXISTS bible_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_email TEXT NOT NULL,
    day_number INT NOT NULL,
    scripture_ref TEXT NOT NULL,
    text TEXT NOT NULL,
    share_personalization BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (member_email, day_number)
  );

  CREATE INDEX IF NOT EXISTS idx_bible_reflections_email_day ON bible_reflections (member_email, day_number DESC);
  ```

- [ ] **Step 2: Commit the migration SQL**
  ```bash
  git add supabase/migrations/20260716000000_create_bible_reflections.sql
  git commit -m "db: create bible_reflections table migration"
  ```

---

### Task 2: Edge Function updates

**Files:**
- Modify: `supabase/functions/governor-state/index.ts`

- [ ] **Step 1: Update the load action to return reflections**
  Modify the `load` action block inside `supabase/functions/governor-state/index.ts` to query the `bible_reflections` table:
  ```typescript
  // In the "load" action block:
  const { data: reflections } = await SB.from("bible_reflections")
    .select("*")
    .eq("member_email", cleanEmail);
  
  // Update the return JSON response object to include reflections:
  return json({
    ok: true,
    entries: entries || [],
    fast: fast || null,
    fast_days: fast_days,
    history: history || [],
    prefs: prefs,
    product_state,
    bundle_key,
    bundle_name,
    next_eligible_date,
    profile,
    recommendation,
    affiliate_ref_id,
    referral_count,
    reflections: reflections || []
  });
  ```

- [ ] **Step 2: Implement save_reflection action**
  Add the `save_reflection` action handler in `supabase/functions/governor-state/index.ts`:
  ```typescript
  if (action === "save_reflection") {
    const { day_number, scripture_ref, text, share_personalization } = payload;
    const { data, error } = await SB.from("bible_reflections").upsert({
      member_email: cleanEmail,
      day_number,
      scripture_ref,
      text,
      share_personalization,
      created_at: new Date().toISOString()
    }, { onConflict: "member_email, day_number" }).select();
    
    if (error) return json({ ok: false, error: error.message }, 200);
    return json({ ok: true, data });
  }
  ```

- [ ] **Step 3: Deploy the updated Edge Function to Supabase**
  Run the deploy command:
  ```bash
  npx supabase functions deploy governor-state --project-ref yzaxzmuuvozonhgwhlim
  ```

- [ ] **Step 4: Commit Edge Function changes**
  ```bash
  git add supabase/functions/governor-state/index.ts
  git commit -m "backend: update governor-state Edge Function to load and save reflections"
  ```

---

### Task 3: Frontend Bible reflections state & save handler

**Files:**
- Modify: `whealthy-command-center-repo/index.html`

- [ ] **Step 1: Add WHEALTHY personalization share checkbox**
  Inside the journal text wrapper element of `#bibleView` (around the text area), insert the opt-in checkbox:
  ```html
  <div style="display:flex; align-items:flex-start; gap:8px; margin:12px 0;">
    <input type="checkbox" checked id="bible_sharePersonalization" style="accent-color:var(--lime); margin-top:2px;">
    <label for="bible_sharePersonalization" style="color:rgba(255,255,255,0.6); font-size:11px; line-height:1.4; cursor:pointer;">Share reflections privately with WHEALTHY to customize my OS experience.</label>
  </div>
  ```

- [ ] **Step 2: Sync reflections on load**
  Update the frontend initialization and `loadState` logic to save returned reflections in `state.reflections` (a local dictionary of day_number -> text):
  ```javascript
  // In frontend loading callback:
  if (d.reflections) {
    const refs = {};
    d.reflections.forEach(r => {
      refs[r.day_number] = { text: r.text, share: r.share_personalization };
    });
    localStorage.setItem('wh_bible_reflections', JSON.stringify(refs));
  }
  ```

- [ ] **Step 3: Implement saveReflection save handler**
  Update the `saveReflection()` save button handler to call the API with the checkbox state:
  ```javascript
  async function saveReflection() {
    const txt = document.getElementById('bible_journalText').value.trim();
    const day = state.currentDayNum || 1;
    const ref = state.scriptureRef || '';
    const share = document.getElementById('bible_sharePersonalization').checked;
    
    // Save to local storage dictionary
    const localRefs = JSON.parse(localStorage.getItem('wh_bible_reflections') || '{}');
    localRefs[day] = { text: txt, share };
    localStorage.setItem('wh_bible_reflections', JSON.stringify(localRefs));
    
    // Send to Supabase API
    try {
      await fetch(FN_BASE + '/governor-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_reflection',
          email: MEMBER_EMAIL,
          day_number: day,
          scripture_ref: ref,
          text: txt,
          share_personalization: share
        })
      });
    } catch(e) {
      console.warn("Failed to sync reflection to database", e);
    }
    
    // Complete the task
    completeSanctuaryTask('reflection');
  }
  ```

- [ ] **Step 4: Load reflection on day change**
  Update the day navigation/rendering function (`renderScriptureDay(dayNum)`) to populate `#bible_journalText` and the checkbox state:
  ```javascript
  const localRefs = JSON.parse(localStorage.getItem('wh_bible_reflections') || '{}');
  const existing = localRefs[dayNum];
  const ta = document.getElementById('bible_journalText');
  const cb = document.getElementById('bible_sharePersonalization');
  if (ta) ta.value = existing ? existing.text : '';
  if (cb) cb.checked = existing ? existing.share !== false : true;
  ```

- [ ] **Step 5: Commit frontend reflection updates**
  ```bash
  git add index.html
  git commit -m "feat: implement private database reflections storage and day sync"
  ```

---

### Task 4: Community Prayer Sanctuary Task Link redirect

**Files:**
- Modify: `whealthy-command-center-repo/index.html`

- [ ] **Step 1: Add inline Skool redirection drawer**
  Inside the Sanctuary Tasks checklist card (under the checkboxes), add the hidden redirection card:
  ```html
  <div id="bible_communityPrayerDrawer" style="display:none; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px; margin-top:8px;">
    <p style="color:rgba(255,255,255,0.75); font-size:12px; line-height:1.5; margin-bottom:12px;">
      <strong>Iron Sharpens Iron</strong><br>
      Share a prayer request or post encouragement on Skool to build our community rapport.
    </p>
    <a href="https://www.skool.com/bakndcreator" target="_blank" class="btn-lime" style="display:inline-flex; text-decoration:none; padding:8px 16px; font-size:11px; font-weight:700; text-transform:uppercase; border-radius:6px; letter-spacing:0.04em;">Go to Skool Community</a>
  </div>
  ```

- [ ] **Step 2: Toggle drawer and mark task complete**
  Update the "Community Prayer" row click handler:
  - Toggling/clicking the row shows the `#bible_communityPrayerDrawer` (expanding it smoothly or displaying it inline).
  - Toggles the checkbox state and marks the task complete in progress.
  ```javascript
  function toggleCommunityPrayerTask() {
    const drawer = document.getElementById('bible_communityPrayerDrawer');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    }
    // Complete Sanctuary Task
    completeSanctuaryTask('community');
  }
  ```

- [ ] **Step 3: Commit community drawer redirect updates**
  ```bash
  git add index.html
  git commit -m "feat: add community prayer link drawer redirect to Skool"
  ```
