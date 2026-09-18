# Roadmap — what the review of 2026-09-17 left open

The read-only review of the whole project (domain, services, repositories,
auth, API, exports, tests, and the app in use) found nine defects, all fixed
the same day (`DESIGN.md`, "Decisions (2026-09-17)"). What follows is what
was *not* done: the risks to plan for, and the opportunities worth taking.
Ordered inside each section by how soon it should be done. Billing is
deliberately left out; it has its own note at the end.

## 1. Scale and performance

Today everything is derived on every request, which is right for a personal
ledger (§4.5) and will stop being fine somewhere around the third year of
heavy use.

| # | Item | Why | How |
|---|---|---|---|
| 1.1 | **Monthly balance checkpoints** | `netWorthOverview` and `cashAtPeriod` read every settled entry of every cash account since the earliest opening date, on every visit to Home, Accounts and Net worth. Two years of the demo user are ~800 rows; a family with three cards passes the §4.5 ceiling (~5,000 rows) in a few years. | A `balance_checkpoints (user_id, account_id, period, balance_cents)` table, one row per closed month, recomputed for the months a write touches (settle, unsettle, edit, delete, opening balance). `accountBalanceAt` starts from the last checkpoint before `until` and replays only the rows after it. Pure function in `domain/balances.ts`, tests against a hand-built history. Same shape for `investmentsAt` when `asset_movements` grows. |
| 1.2 | **Cap the cash-side query** | Even with checkpoints, `cashEntries` has no upper bound on rows. | With 1.1, fetch `settledFrom = last checkpoint period`. Until then, log when a query returns more than 2,000 rows so the moment is known, not guessed. |
| 1.3 | **Fewer queries on Home** | Home runs the month summary (two months of rows, the cash balance), the recurrence preview, the pending months and what earlier months left behind — about eight queries in parallel. Fine per request; it adds up on a slow phone connection. | Cache the read-only parts per user for a short window with `unstable_cache` keyed by `userId`, invalidated by the write actions (they already call `revalidatePath`). Measure first. |
| 1.4 | **Index for the cash-side check** | `portfolioOverview` filters settled contributions and redemptions by `settled_on`; the partial index `entries_user_settled_idx` covers it, but `kind` is not in it. | Add `(user_id, kind, settled_on) where status = 'settled'` if the Portfolio ever shows up in the slow-query log. |
| 1.5 | **CSV of all time** | `/api/export?format=csv` walks every year from the earliest account; one Response built in memory. | Stream it (a `ReadableStream` writing a year at a time) once a user has more than a few thousand rows. |

## 2. Security and privacy

The data model is sound: RLS on every table, `user_id` on every query, owner-carrying foreign keys, sessions through `@supabase/ssr`, API answering 401. What is missing is around it.

| # | Item | Why | How |
|---|---|---|---|
| 2.1 | **Rotate the project's secret key** | A `sb_secret_…` key was pasted in a chat session on 2026-09-16 to create demo users. | Dashboard → API keys → rotate. Never paste it again; use the CLI or the dashboard for user admin. |
| 2.2 | **Account deletion in production** | `deleteUser` needs `SUPABASE_SERVICE_ROLE_KEY`; it is empty in `.env.local` and the profile hides "Delete account" when it is missing. LGPD gives the user the right to erase their data. | Set the key on Vercel (server-only, never `NEXT_PUBLIC_`). Confirm the button appears in production and that the cascade from `auth.users` empties every table. |
| 2.3 | **Terms of use and privacy policy** | Nothing is published; a paying user needs both, and LGPD needs a named controller and a contact. | Two static pages under `/legal`, linked from the login screen and the profile; a consent checkbox on sign-up. |
| 2.4 | **Content-Security-Policy** | The headers in `next.config.ts` cover clickjacking and sniffing; there is no CSP because Next's inline scripts need nonces. | A nonce-based CSP through the proxy (Next's documented pattern), `script-src 'self' 'nonce-…'`, `connect-src` limited to the Supabase URL. Test in report-only first. |
| 2.5 | **Rate limiting** | Supabase Auth throttles sign-in and magic links; the route handlers (`/api/entries`, `/api/export`) have no limit of their own. | Vercel's WAF rate limit on `/api/*` per user cookie, or a small token bucket in the proxy keyed by `sub`. |
| 2.6 | **Audit of the admin path** | User creation for the tutorial used the admin API with the secret key from a laptop. | A `scripts/admin-user.sh` that reads the key from the shell environment, never from a file in the repo or the scratchpad. |
| 2.7 | **Backups and export** | Supabase's daily backups cover the free plan poorly (7 days on Pro). The JSON export is the user's own backup. | Document the restore path (`supabase db dump` + the migrations) and, when billing exists, choose a plan with point-in-time recovery. |

## 3. Tests and CI

157 unit tests cover the eighteen acceptance criteria and every rule in §5; the review of 2026-09-17 added an integrity suite (statements and their payments, card charges, credits, account types). The holes are above the services and in the pipeline.

| # | Item | Why | How |
|---|---|---|---|
| 3.1 | **Continuous integration** | There is no `.github/workflows`; `make check` runs only when someone remembers. | A workflow on push and pull request: `npm ci`, `lint`, `typecheck`, `test`, `build`, on Node 24. Required check before merge. |
| 3.2 | **Browser smoke test** | Nothing exercises a screen; the defects B1, B2 and B8 were only visible in the app. | Playwright (the recipe in `docs/tutorial/` already drives every form) against the Vercel preview URL of each pull request: sign in, add an expense, settle it, undo, add a contribution and split it, pay a statement. A dedicated `ci@` user reset by the admin API before each run. |
| 3.3 | **`summary.ts`** | Month deltas "through the same day", the budget status, `leftBehind` and the settled/planned split have no direct test. | Service tests with the fake repositories, the way `cards.test.ts` does it. |
| 3.4 | **Route handlers and form parsing** | `/api/entries`, `/api/entries/:id/settle`, `/api/recurrences/generate`, `/api/export` and the `allocation:` / `split:` field lifting are untested. | Handler tests that call the exported `GET`/`POST` with a `Request` and a stubbed `getUser`; schema tests for `readAllocationFields`. |
| 3.5 | **RLS test in CI** | `lib/db/__tests__/rls.test.ts` runs only against a local Supabase, so it never runs. | `supabase start` in the workflow (the CLI is a download; Docker is available on GitHub runners), then `make test-db`. |
| 3.6 | **Fake repositories drift** | The fakes enforce some database invariants (settled ⇔ settled_on, counter account, category) but not all (unique recurrence period is there; owner-carrying FKs are not). | Keep adding the invariant to the fake whenever a migration adds one; a comment at the top of `fakes.ts` lists what it checks. |

## 4. Opportunities

### Product

| # | Item | Notes |
|---|---|---|
| 4.1 | **Settle several, each on its own date** | Bulk settle takes one date for all; a "on their dates" option would settle each entry on its competence date — the common case when catching up a past month. |
| 4.2 | **PWA** | Once a week on the phone asks for "Add to home screen": a manifest, icons, a theme colour. `public/` still holds the template SVGs. No offline mode — writes need the server. |
| 4.3 | **Reminders** | An e-mail (or push, with the PWA) two days before a statement is due and when a month has recurring entries to apply. Supabase cron + Resend, or Vercel cron. Out of §1's scope today. |
| 4.4 | **Import** | CSV/OFX import of bank statements is out of scope by `PROMPT.md` §1 and the first thing a paying user asks for. Would need a matching screen (which rows are already recorded) — the derived balances make duplicates visible at least. |
| 4.5 | **"Fix balance"** | Type what the bank shows and get the difference as an entry, discussed on 2026-09-13 and left out. Pairs well with 1.1. |
| 4.6 | **Interface in Portuguese** | The UI is English by decision (§2); the users are Brazilian. A language toggle is a large but mechanical change (a `t()` over every screen). |
| 4.7 | **Assets in a foreign currency** | Dollar assets are tracked in BRL through market adjustments. A `currency` on the asset with the movement in that currency and a rate at the time would separate exchange effect from yield. |
| 4.8 | **Split a statement payment** | A statement is paid whole, from one account. Paying part now and part later (or from two accounts) means several transfers pointing at one statement. |
| 4.9 | **Search by amount and by asset** | Search covers description and notes; "R$ 149,90" and "Tesouro" (the asset of a contribution) would help. |

### Code

| # | Item | Notes |
|---|---|---|
| 4.10 | **One health check** | The Portfolio lists unallocated contributions; Cards lists statement/payment disagreements. A single "Health" section in Settings that runs every check (those two, orphaned statements, accounts whose type changed by hand in SQL) and links to each fix. |
| 4.11 | **Transactions where two writes must land together** | `payStatement`, `settleEntry` with a split and `addMovement` with a cash entry each do 2–4 writes. §4.1 rules out RPCs carrying rules, but a plain SQL function that does nothing except wrap the same inserts in one transaction is storage, not logic. Decide, then do it for these three. |
| 4.12 | **`splitCents`** | In `lib/domain/money.ts`, unused since installments take the amount of each part. Remove or use it for a "total ÷ parts" entry mode. |
| 4.13 | **Handler and action duplication** | Each server action and route handler repeats "parse, call the service, map errors". A small `runAction(schema, fn)` would halve `app/**/actions.ts`. |
| 4.14 | **Recurrence preview by date edited** | `previewFrom` recognises a generated entry by `recurrence_id` and its date's month; an entry generated for a month and then moved to another month by hand reads as "not applied". Use the `period` column instead of the date. |

## Billing (deferred)

Decided on 2026-09-17 to leave for later. The analysis: one plan with a
30-day trial and a read-only mode after it (data always visible and
exportable, writes blocked), no freemium; Stripe (card and Pix) or a
merchant of record (Paddle, Lemon Squeezy) depending on who issues the
invoice; a `subscriptions` table written only by the webhook; entitlement
computed in `getContext()` and enforced in the services (`assertWritable`),
not only in the proxy; terms, privacy and LGPD first (§2 above).
