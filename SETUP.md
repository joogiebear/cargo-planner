# Cargo Planner — Setup

A planning-only tool for fine-arts shipping & storage companies. Plan how a job's crates fit on trucks, see how many trucks you'll need, print the manifest.

**Stack:** Vite + React 18 (frontend), Supabase (Postgres + Auth + RLS), Vercel (hosting).

---

## Prereqs
- Node 18+
- A Supabase project (free tier is fine)
- A Vercel account
- Optional: a custom domain

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL + anon key
npm run dev
```

Open http://localhost:5173.

## First-time database setup

Open the Supabase SQL Editor and run the migrations in this order. They're all idempotent — re-runs are safe.

1. **`supabase/schema.sql`** — tables, types, indexes, triggers
2. **`supabase/functions.sql`** — `save_scenario` RPC for atomic scenario upserts
3. **`supabase/admin_user.sql`** — bootstraps the first admin user (edit the email at the top before running)
4. **`supabase/0002_truck_types.sql`** — adds the new short truck types (Sprinter / ST / TT) to the enum
5. **`supabase/0003_shipments_metadata.sql`** — adds the metadata column shipments need
6. **`supabase/0004_rls.sql`** — enables row-level security on every table

Optional last step:

7. **`supabase/demo.sql`** — populates 4 facilities, 9 trucks, 14 crates, 5 demo users, 3 sample jobs

## Reset workflow (start over)

```sql
-- in Supabase SQL Editor
\i supabase/wipe.sql
\i supabase/admin_user.sql   -- restores your admin row
\i supabase/demo.sql         -- optional, if you want demo data back
```

In the browser, run `localStorage.clear()` then refresh. The wipe preserves your admin user; everything else is cleared.

## Supabase Auth setup

### Magic link (default)
Already configured. **Authentication → URL Configuration**:
- **Site URL:** your production URL (e.g., `https://cargo-planner.vercel.app`)
- **Redirect URLs:** add both `http://localhost:5173/**` and your production URL with `/**`

⚠️ Supabase's built-in email service is heavily rate-limited (~4/hr). For real usage, configure custom SMTP under **Authentication → SMTP Settings** — see "Custom SMTP" below.

### Google OAuth (swap-in for orgs that use Google Workspace)

1. **Authentication → Providers → Google** → Enable
2. Follow the on-screen instructions to create a Google Cloud OAuth 2.0 client (Authorized redirect URIs include the URL Supabase shows you)
3. Paste the client ID + secret into Supabase
4. In `src/SignIn.jsx`, replace the magic-link form with `supabase.auth.signInWithOAuth({ provider: 'google' })`. Tag me a TODO if you want this swap pre-built.

The rest of the app (RLS, role gating, facility scoping) works identically regardless of which sign-in method you use — it all flows through `auth.uid()` and the email match in `users` table.

### Disable open signup

After your team is invited (rows exist in `users` for everyone you want to allow), tighten signup:

**Authentication → Sign In / Up → "Allow new users to sign up"** → toggle **off**. Combined with RLS, this gives you defense in depth.

### Custom SMTP (Resend, recommended)

1. Sign up at [resend.com](https://resend.com) (free, 3000 emails/month)
2. Verify a sending domain (or use `onboarding@resend.dev` for testing)
3. Create an API key
4. Supabase **Authentication → SMTP Settings** → Enable Custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: *your API key*
   - Sender email: any verified address

Also bump the limits under **Authentication → Rate Limits** (defaults are conservative).

## Vercel deploy

1. Push to GitHub
2. Vercel → Add New → Project → import the repo
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (Both for Production, Preview, and Development.)
4. Deploy

After Vercel gives you a URL, add it to Supabase **Authentication → URL Configuration → Redirect URLs** so magic-link callbacks work.

## Roles

| Role | What they can do |
|---|---|
| `admin` | Everything: facilities, users, trucks, jobs, scenarios |
| `regional` | Multi-facility manager — manage trucks, jobs, scenarios at their assigned facilities |
| `facility` | Site manager — same as regional but typically scoped to one facility |
| `planner` | Build and edit jobs/scenarios at their assigned facilities. Cannot manage trucks or users. |
| `viewer` | Read-only across their assigned facilities |

Role gating is enforced both client-side (UI hides controls) and server-side (RLS in Postgres). See `supabase/0004_rls.sql` for the full policy set.

## Project structure

```
cargo-planner/
├── src/
│   ├── main.jsx          # Vite entry, hydrates from Supabase before mount
│   ├── AuthGate.jsx      # Auth wrapper around App
│   ├── SignIn.jsx        # Magic-link sign-in screen
│   ├── auth.js           # Auth helpers
│   ├── supabase.js       # Configured Supabase client
│   ├── sync.js           # All Supabase reads/writes (the data layer)
│   ├── loadData.js       # Boot-time hydration: facilities, trucks, crates, users, shipments, scenarios, audit
│   ├── app.jsx           # Main App component, Load Plan view, planner state
│   ├── pages.jsx         # Jobs / Trucks / Scenarios pages, dialogs
│   ├── admin.jsx         # Admin tab (Users / Facilities / Trucks / Roles / Audit / Data)
│   ├── viz.jsx           # Bin packer + 3D truck visualization
│   ├── tweaks-panel.jsx  # Floating tweaks panel (theme, view mode, density)
│   └── data.js           # Empty fallback CP_DATA so first-paint doesn't crash before hydration
├── supabase/
│   ├── schema.sql, functions.sql, admin_user.sql, demo.sql, wipe.sql
│   └── 0002_*.sql, 0003_*.sql, 0004_*.sql  # versioned migrations
├── package.json
└── vite.config.js
```

## Troubleshooting

**Magic link doesn't redirect back to my deployed site**
Site URL or Redirect URLs in Supabase Authentication don't match your Vercel URL. Add `https://your-app.vercel.app/**` (note the `/**`) to Redirect URLs.

**"Email rate limit exceeded"**
Supabase's built-in email is capped. Either wait an hour or set up custom SMTP (above).

**App is blank after deleting facilities**
LocalStorage holds stale references. Run `localStorage.clear()` in DevTools console and refresh.

**RLS too tight / too loose**
Re-run `supabase/0004_rls.sql` after editing — the cleanup block at the top drops all old policies first so re-runs are safe.

**Adding a teammate**
Admin → Users → + Invite user → enter their email + role + facility access. They sign in with the same email and the existing row links to their `auth.users` automatically on first login.
