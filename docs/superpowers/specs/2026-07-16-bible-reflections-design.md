# Specification - Bible Reflections Storage & Community Prayer Integration

This document specifies the technical design to log Bible study reflections privately to a Supabase database table and link the Community Prayer task to the Skool community for active engagement.

## 1. Database Schema (Supabase)

We will create a new table `bible_reflections` in Supabase to persist user scripture journal entries.

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

## 2. API & Edge Function Integration (`governor-state`)

We will modify the `governor-state` Supabase Edge Function to support loading and saving reflections:

1. **`action === "load"`**:
   Extend the returned JSON response payload to include all saved reflections for the logged-in member:
   ```ts
   const { data: reflections } = await SB.from("bible_reflections")
     .select("*")
     .eq("member_email", cleanEmail)
     .order("day_number", { ascending: true });
   ```

2. **`action === "save_reflection"`**:
   Add a handler to save/upsert a reflection:
   ```ts
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

## 3. Frontend Layout & Interactions (`index.html`)

### A. Bible Reflections Journal (Verse Card)
- **Checkbox Toggle**: Add a checkbox below the Daily Reflection Journal textarea:
  `[x] Share reflections privately with WHEALTHY to customize my OS experience (Archetype analysis, tailored comfort scriptures).`
- **State Synchronization**:
  - On page load, fetch all user reflections from the database (via `governor-state` `load`).
  - When navigating days in the Bible study widget, populate the textarea if a reflection already exists for that day.
  - Clicking "Save Reflection" performs a POST request to `governor-state` with action `save_reflection`, saves the entry locally, and checks off the "Reflection Journaling" task on the Sanctuary Tasks card.

### B. Community Prayer Task (Sanctuary Tasks)
- **Inline Prompt Drawer**:
  - Clicking the "Community Prayer" Sanctuary Task row opens a small, styled drawer directly below the checklist.
  - The drawer displays encouragement:
    > **Iron Sharpens Iron**
    > Share a prayer request or pray over fellow Stewards' requests on Skool to build our community rapport.
  - Includes a link button `[ Go to Skool Community ]` pointing to `https://www.skool.com/bakndcreator` (opening in a new window/tab).
  - Toggling the task checkbox marks it complete locally and updates the database progress.
