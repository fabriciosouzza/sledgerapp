# Portability — leaving Supabase

sledger uses Supabase for two things: hosted Postgres and Auth. Business rules
live in TypeScript (`lib/domain/`, `lib/services/`), so moving elsewhere touches
only what is listed here. Keep this file current as the code grows.

| What | Where | Change |
|---|---|---|
| Auth adapter | `lib/auth/session.ts`, `lib/auth/adapter.ts`, `lib/auth/proxy.ts` | Re-implement `getUser`, sign-in/up, magic link, sign-out and the per-request session refresh for the new provider. `SessionUser` is the only type the rest of the app sees. |
| DB client factory | `lib/db/client.ts`, `lib/db/env.ts` | Return a client for the new driver (e.g. Drizzle over `postgres`) and read its connection settings. |
| Repositories | `lib/repositories/` | Rewrite the queries; method signatures stay, callers do not change. |
| Auth callback & route protection | `app/auth/callback/route.ts`, `proxy.ts` | The callback calls `completeEmailLink`; `proxy.ts` calls `updateSession`. Swap what those adapters do, not the callers. |
| `auth.users` foreign keys | `supabase/migrations/` | Every `user_id` references `auth.users(id)`; point it at the new users table. |
| `auth.uid()` in RLS policies | `supabase/migrations/` | Replace with the new host's notion of the current user (e.g. `current_setting('app.user_id')::uuid`), or drop RLS — services already scope every query by `user_id`. |
| Local stack & migration runner | `supabase/config.toml`, the Supabase CLI | Plain Postgres plus any migration runner; the SQL is standard Postgres. |
| Environment | `.env.example`, Vercel settings | Replace `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| Packages | `package.json` | Remove `@supabase/ssr`, `@supabase/supabase-js`, `supabase`. |

Untouched: `lib/domain/`, `lib/services/`, `lib/schemas/`, every screen.

The schema needs Postgres 15+ (`unique nulls not distinct` on categories) and
uses nothing else host-specific: enums, check constraints, a partial unique
index, `gen_random_uuid()`, and a plain `updated_at` trigger.
