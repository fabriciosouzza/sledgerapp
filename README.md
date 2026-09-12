# sledger

Simple ledger — a personal finance app used on a phone, once a week. The build
specification this project was created from is [PROMPT.md](PROMPT.md); read it
before changing anything.

**Status:** stage 4 of 13 — accounts and categories (repositories, services,
`/settings`) and the starting seed, on top of auth, the app shell, the domain
rules and the schema ([PROMPT.md §11](PROMPT.md#11-build-order)).

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
| `make test` | Vitest |
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

**Test user.** `make dev-user` creates `dev@sledger.local` / `sledger-dev-1234`
in the local Supabase (override with `DEV_USER_EMAIL` / `DEV_USER_PASSWORD`).
Accounts and categories are seeded on the first sign-in, so a fresh
`supabase db reset` + `make dev-user` is a clean slate.

After changing a migration, regenerate the row types:

```sh
supabase gen types typescript --local > lib/db/database.types.ts
```

## Deploy

Vercel, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set,
and `https://<your-app>/auth/callback` added to Supabase's redirect URLs.

## Layout

```
app/                screens, server actions, route handlers — call services only
lib/services/       validate → apply rules → persist → return DTO
lib/domain/         pure TypeScript: every business rule, unit tested
lib/repositories/   the only code that talks to the database
lib/auth/, lib/db/  the only Supabase-specific code — see PORTABILITY.md
supabase/           config and migrations
```
