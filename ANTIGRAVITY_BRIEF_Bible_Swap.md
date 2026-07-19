# ANTIGRAVITY BRIEF: Bible Layer Swap (bible-api.com -> owned library)

**Date:** July 19, 2026
**Status of backend: ALREADY LIVE. Do not rebuild it.**
**Scope: exactly two URL changes in `whealthy-command-center-repo/index.html`. Nothing else.**

---

## What already exists (built and verified today, do not re-create)

- Table `public.bible_verses`: the complete Berean Standard Bible (public domain), 31,102 verses, 66 books. RLS ON, zero public policies, service role only, per house rule. Migration name: `create_bible_verses_library`.
- Edge function `bible-verses` (ACTIVE, verify_jwt disabled like the other page-called functions). It holds the service role; the page sends no keys.
- Response shape is a drop-in match for bible-api.com: `{ reference, verses:[{book_name, chapter, verse, text}], text, translation_id, translation_name, error? }`.
- Verified live, HTTP 200 on all four:
  - `?ref=John 3:16` -> 1 verse
  - `?ref=1 Kings 19:7-8` -> 2 verses
  - `?ref=Psalm 23` -> alias resolves to Psalms, 6 verses
  - `?ref=Genesis 1-2` -> 56 verses in ONE call. Multi-chapter ranges work. This is the fix bible-api.com could never give us.

Endpoint:

```
https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/bible-verses?ref=<encoded reference>
```

Accepted forms: `John`, `John 3`, `John 3:16`, `John 3:16-18`, `Genesis 1-2`, `John 3:16-4:2`. Numbered books in either style (`1 Kings` or `I Kings`). `Psalm`/`Psalms` both fine.

---

## Change 1 of 2: `fetchSingleChapter` (around line 8251)

**Before**

```js
async function fetchSingleChapter(book,chapter){
  const suffix = chapter ? '+' + chapter : '';
  const url='https://bible-api.com/'+encodeURIComponent(book)+suffix;
```

**After**

```js
async function fetchSingleChapter(book,chapter){
  const ref = chapter ? (book + ' ' + chapter) : book;
  const url='https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/bible-verses?ref='+encodeURIComponent(ref);
```

Everything below those lines stays byte-identical. The function already reads `data.verses`, `data.reference`, `data.error`; the new endpoint returns the same fields.

## Change 2 of 2: the verse panel fetch (around line 13552)

**Before**

```js
const r=await fetch('https://bible-api.com/'+encodeURIComponent(ref));
```

**After**

```js
const r=await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/bible-verses?ref='+encodeURIComponent(ref));
```

Use the full literal URL at both sites. Do not rely on `FN_BASE` being in scope at either location.

---

## Optional phase 2 (separate change, only after the swap is verified live)

`fetchScripture` currently loops chapters one at a time because of the old API's multi-chapter failure (comment near line 8272). The loop still works fine against the new endpoint, so leaving it is safe. Later, it can collapse to a single `bible-verses?ref=Book C1-C2` call. Do NOT bundle that refactor with this swap.

## Do not touch

- `governor-ai` (its scripture whitelist is a separate, later change)
- Bible 365 reference library, reading-plan logic, `parseRef`, caching
- Any other fetch in the page

## Expected visible difference, so nobody calls it a bug

Verse TEXT will read slightly differently: bible-api.com served the World English Bible; the owned library serves the Berean Standard Bible (also public domain, reads more modern). References, verse numbers, and layout are unchanged. If any UI label names the translation, it should say Berean Standard Bible (BSB).

## Acceptance checks after the baknd paste

1. Bible 365: open today's reading, verses render, no console errors.
2. Verse panel: open a passage from a card, text renders with verse numbers, Read Aloud still works.
3. Governor: "read John 3:16" renders and speaks.
4. A numbered book (1 Kings 19) and a Psalm both load.
5. Network tab shows calls to `/functions/v1/bible-verses`, zero calls to bible-api.com.

## Deploy

Edit `index.html`, paste in full into the baknd embed for /command-center, publish, hard refresh. Edge function and table are already live; no function deploys needed for this brief.
