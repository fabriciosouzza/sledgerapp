# sledger

Simple ledger — a personal finance app used on a phone, once a week. The build
specification this project was created from is [PROMPT.md](PROMPT.md); read it
before changing anything.

**Status:** stage 3 of 13 — auth (login, magic link, callback, proxy, sign
out) and the app shell with navigation, on top of the domain rules and schema
([PROMPT.md §11](PROMPT.md#11-build-order)).

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
