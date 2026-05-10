# Cargo Planner — Setup

## Prereqs
- Node 18+ (you have 22 — fine)
- A Supabase account (free tier is plenty)
- A Vercel account for deploy (Phase 5)

## Local dev (Vite, no backend)
```bash
npm install
npm run dev
```
Opens http://localhost:5173. Currently uses `localStorage` only — no backend yet.

## Phase 2 — Supabase project

1. Go to https://supabase.com → **New project**.
   - Name: `cargo-planner`
   - Pick a strong DB password (save it; you won't need it day-to-day)
   - Region: closest to you
2. Wait ~2 min for the project to provision.
3. In the Supabase dashboard → **SQL Editor** → **New query**:
   - Paste the entire contents of `supabase/schema.sql`. Click **Run**.
   - Then paste the entire contents of `supabase/seed.sql`. Click **Run**.
   - The seed prints a notice like `Facilities: 4, Users: 7, Trucks: 6, Crates: 14`.
4. In **Project Settings → API**, copy:
   - **Project URL**
   - **anon / public** key
5. Create `.env.local` at the repo root:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   (Vite only exposes `VITE_`-prefixed env vars to the client — that's intentional.)

The schema does **not** enable Row Level Security yet. Until Phase 4 (auth wire-up), the database is trusted-client-only — keep the anon key out of public repos and don't deploy to production yet.

## Phase 3 — CP_STORE → Supabase (next step, code change)
The single seam in `src/app.jsx:45` (`CP_STORE`) gets rewritten to call Supabase. Components don't change. I'll handle this next.

## Phase 4 — Auth
Replace the "Acting as…" picker with Supabase Auth (magic link). Wire RLS policies — sketches are in `SCHEMA.md`.

## Phase 5 — Deploy (Vercel)
```bash
# from the repo root, after `vercel login`
vercel
```
Then in the Vercel project settings, add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables for Production / Preview / Development.

## Re-running the seed
Both `schema.sql` and `seed.sql` are idempotent — re-running them won't error, and re-running seed will update existing rows by `legacy_id`. To wipe everything and start fresh, run in SQL Editor:
```sql
drop schema public cascade;
create schema public;
```
Then paste schema.sql + seed.sql again.
