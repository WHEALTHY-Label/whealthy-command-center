# Task: Push the WHEALTHY Command Center live

You are working on a local git repo on macOS. Goal: get it onto GitHub and deployed to production on Vercel.

## Repo

Absolute path (note the trailing space in the parent folder name, it is real):

```
/Users/iiggie/Desktop/WHEALTHY LABE SITE /WHEALTHY STEWARDS/whealthy-command-center-repo
```

Always quote this path: `cd ~/Desktop/"WHEALTHY LABE SITE "/"WHEALTHY STEWARDS"/whealthy-command-center-repo`

## Current state (verified)

- Branch: `main`
- One commit: `d52b574` "WHEALTHY Command Center: initial import"
- Working tree clean
- **No remote configured yet**
- Stale lock files exist in `.git/` (`HEAD.lock`, `index.lock`). Delete them first or git commands will fail.

Tracked files:

```
index.html                              307,330 bytes  (the entire app, single file)
README.md
.gitignore                              (.DS_Store, node_modules/, *.log, .env, .env.*)
docs/CHANGELOG-2026-07-13.md
supabase/functions/get-leaderboard/index.ts
supabase/functions/get-leaderboard-names/index.ts
supabase/functions/verify-member/index.ts
supabase/functions/governor-ai/index.ts
supabase/functions/governor-state/index.ts
```

## Targets

- GitHub repo: `https://github.com/WHEALTHY-Label/whealthy-command-center.git`
- Vercel team: `SIPS HEALTHCARE SOLUTIONS` (slug `sips-healthcare-solutions`, id `team_ePajvo1uCVVsbvJHZsXPrepW`)
- Vercel project: `whealthy` (id `prj_0Ju0B5KYjA8z9vrlghwTp2MhLUw2`) — already exists, do not create a new one
- Supabase backend the app calls: `https://yzaxzmuuvozonhgwhlim.supabase.co` (production)

## Step 1: Push to GitHub

```bash
cd ~/Desktop/"WHEALTHY LABE SITE "/"WHEALTHY STEWARDS"/whealthy-command-center-repo
rm -f .git/*.lock
git remote add origin https://github.com/WHEALTHY-Label/whealthy-command-center.git
git push -u origin main
```

If auth fails, run `gh auth login` first, or use a personal access token as the password. Do not use the account password.

If the remote already exists, use `git remote set-url origin <url>` instead of `add`.

## Step 2: Deploy to Vercel production

This is a **static single-file app**. No build step, no framework, no dependencies.

```bash
cd ~/Desktop/"WHEALTHY LABE SITE "/"WHEALTHY STEWARDS"/whealthy-command-center-repo
npx vercel link --yes --project whealthy --scope sips-healthcare-solutions
npx vercel --prod
```

Settings if prompted, or when configuring in the dashboard:

- Framework preset: **Other**
- Build command: **none / empty**
- Install command: **none / empty**
- Output directory: **`.`**
- Root directory: **`.`**

Vercel serves `index.html` at the root.

## Step 3: Connect the repo for auto-deploy (do after Step 1 succeeds)

Vercel dashboard, project `whealthy`, Settings, Git, connect `WHEALTHY-Label/whealthy-command-center`. Every push to `main` then auto-deploys.

## Constraints

- Do **not** commit or push any `.env` file, Supabase service-role key, or Stripe secret key. `index.html` was scanned and currently contains no secrets, only the publishable anon key. Keep it that way.
- Do **not** rewrite, reformat, minify, or regenerate `index.html`. It is 307 KB of hand-built app code. Move the bytes as-is.
- The `supabase/functions/*` files are Deno edge functions. Vercel does **not** deploy them and must not. They live in the repo for version history only. Deploy them with the Supabase CLI separately if needed.

## Verify after deploy

Open the production URL and confirm:

1. The login gate renders and accepts a valid member
2. The Governor tab loads state
3. The Bible tab loads
4. Browser console shows no CORS errors against `yzaxzmuuvozonhgwhlim.supabase.co`

## Important

The Supabase edge functions allow any origin, so the app works from the Vercel URL with no code change. That also means the moment this URL is live it is a **real member surface hitting live production data**, not a staging sandbox. Treat it accordingly.
