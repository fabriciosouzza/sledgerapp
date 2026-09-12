# Portability — leaving Supabase

sledger uses Supabase for two things: hosted Postgres and Auth. Business rules
live in TypeScript (`lib/domain/`, `lib/services/`), so moving elsewhere touches
only what is listed here.

| What | Where | Change |
|---|---|---|
| Auth adapter | `lib/auth/session.ts`, `lib/auth/adapter.ts`, `lib/auth/proxy.ts` | Re-implement `getUser`, sign-in/up, magic link, sign-out and the per-request session refresh for the new provider. `SessionUser` is the only type the rest of the app sees. |
| DB client factory | `lib/db/client.ts`, `lib/db/env.ts`, `lib/db/database.types.ts` | Return a client for the new driver (e.g. Drizzle over `postgres`), read its connection settings, and regenerate or hand-write the row types. |
| Repositories | `lib/repositories/*.ts` | Rewrite the queries. Method signatures stay, so services and screens do not change. Two PostgREST idioms live here: `upsert(..., { onConflict, ignoreDuplicates })` for idempotent generation and lazy statements, and `select(..., { count: "exact", head: true })` for counts. |
| Repository errors | `lib/repositories/errors.ts` | `fromPostgres` maps SQLSTATE codes (`23503`, `23505`, `23514`) and PostgREST's `PGRST116`; keep the SQLSTATE mapping, drop the PostgREST one. |
| Auth callback & route protection | `app/auth/callback/route.ts`, `proxy.ts` | The callback calls `completeEmailLink`; `proxy.ts` calls `updateSession`. Swap what those adapters do, not the callers. |
| API auth | `app/api/_lib/handler.ts` | Calls `getUser` and `createClient`; nothing else in `app/api/` knows the provider. |
| Seeding | `lib/services/seed.ts` | Provider-agnostic already (called from the sign-in actions and the callback). Wire it to the new sign-up path. |
| `auth.users` foreign keys | `supabase/migrations/` | Every `user_id` references `auth.users(id)`; point it at the new users table. |
| `auth.uid()` in RLS policies | `supabase/migrations/` | Replace with the new host's notion of the current user (e.g. `current_setting('app.user_id')::uuid`), or drop RLS — services already scope every query by `user_id`. |
| RLS test | `lib/db/__tests__/rls.test.ts` | Uses the Supabase admin API to mint two users; rewrite against the new auth, keep the assertions. |
| Local stack & migration runner | `supabase/config.toml`, the Supabase CLI, `scripts/dev-user.sh`, `make test-db` | Plain Postgres plus any migration runner; the SQL is standard Postgres. The dev-user script calls the Supabase admin endpoint. |
| Environment | `.env.example`, Vercel settings | Replace `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| Packages | `package.json` | Remove `@supabase/ssr`, `@supabase/supabase-js`, `supabase`. |

Untouched: `lib/domain/`, `lib/services/` (except the seed hook), `lib/schemas/`,
every screen, every server action, every component.

The schema needs Postgres 15+ (`unique nulls not distinct` on categories) and
uses nothing else host-specific: enums, check constraints, unique indexes,
`gen_random_uuid()`, and a plain `updated_at` trigger. `entries.list` uses
PostgREST's `or=(account_id.in.(…),counter_account_id.in.(…))` for the
"entries touching these accounts" filter behind derived balances.
