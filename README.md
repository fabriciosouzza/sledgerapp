# sledger

Simple ledger — a personal finance app used on a phone, once a week. The build
specification this project was created from is [PROMPT.md](PROMPT.md); read it
before changing anything.

**Status:** every stage of [PROMPT.md §11](PROMPT.md#11-build-order) plus the
UI iteration in [DESIGN.md](DESIGN.md). Two deliberate deviations from the
spec, both recorded there: balances are derived from entries (no snapshots),
and the month screen is Review at `/review`.

## Run it locally

Only **Docker** is needed; Node runs in a container.

```sh
docker compose up        # or `make dev` → http://localhost:3000
```

The first run installs dependencies. If port 3000 is taken:
`APP_PORT=3001 docker compose up`.

## Commands

All run inside the container; `make help` lists them.

| Command | |
|---|---|
| `make check` | lint + typecheck + tests |
| `make test` | Vitest (unit tests; the RLS test is skipped) |
| `make test-db` | Vitest including the RLS test against the local Supabase |
| `make build` | `next build` |
| `make npm args="install zod"` | any npm command |
| `make sh` | shell in the container |
| `make dev-user` | create the local test user (needs `supabase start`) |

## Database

Postgres is storage, not logic: tables, constraints, indexes and RLS — no views,
no RPC, no triggers except `updated_at`
([PROMPT.md §4.1](PROMPT.md#41-postgres-is-storage-not-logic)). The schema lives
in `supabase/migrations/`.

Auth needs a Supabase instance, local or hosted. Copy `.env.example` to
`.env.local` and fill in the two variables.

**Local Supabase** needs the [Supabase CLI](https://supabase.com/docs/guides/local-development)
on the host (it drives Docker itself): `supabase start` boots Postgres + Auth
and prints the URL and anon key; `supabase db reset` applies the migrations.
Emails (magic links, confirmations) land in the Inbucket UI printed by
`supabase status`. Sign-up works without email confirmation locally.

Because the app runs in Docker, `NEXT_PUBLIC_SUPABASE_URL` must be
`http://host.docker.internal:54321`, not `127.0.0.1` — see `.env.example`.

**Account deletion** (Settings → Profile) only appears when
`SUPABASE_SERVICE_ROLE_KEY` is set on the server — never as `NEXT_PUBLIC_`.
Locally it is printed by `supabase status`.

**Test user.** `make dev-user` creates `dev@sledger.local` / `sledger-dev-1234`
in the local Supabase (override with `DEV_USER_EMAIL` / `DEV_USER_PASSWORD`).
Accounts and categories are seeded on the first sign-in, so a fresh
`supabase db reset` + `make dev-user` is a clean slate.

**"JWT issued at future"** (a 401 from PostgREST, sometimes right after
signing in): the Docker VM's clock drifted from the host's, usually after the
Mac slept. PostgREST tolerates 30 s. Fix the clock (restart Docker Desktop, or
`docker run --rm --privileged alpine hwclock -s`) and reload.

After changing a migration, regenerate the row types:

```sh
supabase gen types typescript --local > lib/db/database.types.ts
```

## API

Route handlers mirror the server actions and call the same services
([PROMPT.md §4.3](PROMPT.md#43-server-actions-and-route-handlers)). They use
the session cookie, so call them from a signed-in browser or forward its
cookies; without a session they answer `401`.

| | |
|---|---|
| `GET /api/entries?period=2026-11[&status=&kind=&account=&category=&q=]` | entries of a month |
| `POST /api/entries` | JSON with the `/add` form's fields (`amountCents` as `"149,90"` or cents) |
| `PATCH /api/entries/:id/settle` | `{ "settledOn"?: "2026-11-05", "settled"?: false }` |
| `POST /api/recurrences/generate` | `{ "period"?: "2026-11", "dryRun"?: true }` |
| `GET /api/summary?period=2026-11` | the month's metrics, categories and planned entries |
| `GET /api/statements` | every card with open and past statements |
| `GET /api/export` | everything the user owns as one JSON file (Settings → Profile → Download export) |

## Tests

`lib/domain/__tests__` cover the rules in PROMPT.md §5 without a database;
`lib/services/__tests__` run the services against in-memory fake repositories
(`fakes.ts`); `lib/db/__tests__/rls.test.ts` needs the local Supabase and two
users, and only runs under `make test-db`. Together they prove every item of
[PROMPT.md §12](PROMPT.md#12-acceptance-criteria).

## Deploy

The app is a stock Next.js build with Supabase behind it; nothing else runs.

1. **Supabase project.** Create one, then from the repo:
   `supabase link --project-ref <ref>` and `supabase db push` (applies every
   file in `supabase/migrations/`, in order). Keep the service role key out of
   the repo.
2. **Auth settings** (dashboard → Authentication → URL configuration): site
   URL `https://<your-app>` and `https://<your-app>/auth/callback` in the
   redirect URLs. Magic links and password resets are emails: the default
   Supabase sender is rate-limited (a few per hour) and fine for one person;
   set a custom SMTP (Authentication → SMTP) for anything more. Password
   sign-in does not need email at all.
3. **Vercel** (or any Node host): import the repo, framework Next.js, and
   set the environment variables
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon / publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` — optional, server-only; enables "Delete my
     account" on the profile page. Leave it unset and the button explains.
   - `NEXT_PUBLIC_SITE_URL` — optional, `https://<your-app>`; where magic
     links and password resets come back to. Unset, the request's host is used.

   `next build` needs nothing else; the `Dockerfile` is for local work only.
4. **Time.** Sessions are validated against the server clock; the "JWT issued
   at future" retry exists for laptops waking from sleep and is harmless on a
   host with NTP.

## Layout

```
app/                screens, server actions, route handlers — call services only
lib/services/       validate → apply rules → persist → return DTO
lib/domain/         pure TypeScript: every business rule, unit tested
lib/repositories/   the only code that talks to the database
lib/auth/, lib/db/  the only Supabase-specific code — see PORTABILITY.md
supabase/           config and migrations
```
