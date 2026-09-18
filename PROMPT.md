# sledger — build specification

You are building **sledger** (simple ledger), a personal finance app, from
scratch. Read this entire document before writing any code. The data model and
the business rules below were validated in practice — do not reinterpret them.

---

## 1. Scope

A web app the owner uses **on a phone, once a week**, to:

- record what was spent, and settle what has already been paid;
- see what is still **due** (bills, installments, planned income);
- track savings rate, fixed cost and net worth over time;
- record investment contributions and yield without any market quotes.

**Out of scope for this phase.** Do not implement, do not stub, do not create
tables for: CSV/OFX import, Open Banking, chat bots, sharing between users,
native apps.

Mobile-first is a hard requirement. A screen that only works on desktop is a bug.

---

## 2. Language convention

- **Code, database, API and UI are in English.** Table names, column names,
  enum values, route names, variable names, UI labels, commit messages.
- **User data is whatever the user types** — mostly Brazilian Portuguese.
  Descriptions, category names, account names, notes.
- Seed data ships in Portuguese, because it is data (see §10).
- Formatting is `pt-BR`: currency `R$ 1.234,56`, dates `dd/MM/yyyy`, timezone
  `America/Sao_Paulo`. English UI, Brazilian formatting. That combination is
  intentional.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, latest stable), TypeScript `strict` |
| UI | Tailwind + shadcn/ui |
| Charts | Recharts |
| Database | Postgres, hosted on Supabase |
| Auth | Supabase Auth (email/password + magic link) via `@supabase/ssr` |
| Validation | Zod, shared between client and server |
| Dates | date-fns + date-fns-tz |
| Tests | Vitest |
| Deploy | Vercel |

---

## 4. Architecture — read this before designing anything

The owner wants to be able to **leave Supabase later** and to **change business
rules without touching SQL**. That drives the whole layout.

### 4.1 Postgres is storage, not logic

The database holds tables, constraints, indexes and RLS. Nothing else.

- **No views.** No `v_*` anything.
- **No stored procedures, no RPC, no triggers carrying business rules.**
  The only acceptable trigger is `updated_at`.
- No aggregation in SQL beyond what a query builder naturally produces
  (`where`, `order by`, `limit`, and a simple `sum`/`count` when fetching a full
  page of rows would be absurd).

Constraints stay in the database. They are portable standard SQL and they are
the last line of defence against a bug in the app writing nonsense. RLS stays
too — it is plain Postgres and it survives a move to any other Postgres host.

### 4.2 Four layers, one direction of dependency

```
app/            React Server Components, server actions, route handlers
  └── services/       orchestration: validate → apply rules → persist → return DTO
        ├── domain/        pure TypeScript. No I/O. Never imports the db client.
        └── repositories/  the ONLY place that talks to the database
```

- `domain/` is pure functions and types: money math, cycle resolution,
  installment expansion, recurrence expansion, metric computation. Every rule in
  §5 lives here and is unit tested without a database.
- `repositories/` expose intention-revealing methods
  (`entries.listByPeriod(userId, period)`, `entries.insertMany(rows)`), never
  leaking a Supabase query builder to the caller. Swapping to Drizzle or Prisma
  means rewriting this folder and nothing else.
- `services/` compose repositories and domain. This is where "settle entry" or
  "create installment purchase" lives.
- `app/` only calls services. A React component never imports a repository and
  never recomputes a metric.

### 4.3 Server actions and route handlers

- **Server actions** for everything the UI triggers: create, update, settle,
  delete, generate month. They validate with Zod, call a service, and
  `revalidatePath`.
- **Route handlers** under `app/api/` mirroring the same services, for whatever
  calls the app from outside later (a script, a bot):
  `POST /api/entries`, `PATCH /api/entries/:id/settle`,
  `POST /api/recurrences/generate`, `GET /api/summary?period=2026-11`.
- Both paths must call the **same service function**. If a rule lives in a
  server action and the route handler reimplements it, that is a defect.

### 4.4 What is Supabase-specific, and where it is allowed

Only two places: the auth adapter (`lib/auth/`) and the client factory
(`lib/db/client.ts`). Write a short `PORTABILITY.md` listing exactly what a
migration away from Supabase would touch.

### 4.5 Performance boundary

Metrics are computed in TypeScript from rows fetched by period. That is fine for
a personal ledger: a heavy month is a few hundred rows. Always fetch by period,
never the whole table. If a screen would need more than roughly 5,000 rows to
render, stop and ask before building it.

---

## 5. Business rules

This section is why the app exists. Most finance apps get this wrong and start
lying to the user.

### 5.1 Money is integer cents

`amount_cents bigint`, always **positive**, `check (amount_cents > 0)`. The
`kind` decides the sign when aggregating. Never store a negative amount, never
use floats, never map `numeric` to a JS number.

Only one exception in the entire system: `market_adjustment` on an asset
movement, which may be negative.

### 5.2 The five entry kinds

| `kind` | What it is | Counts as income? | Counts as expense? | Net worth |
|---|---|---|---|---|
| `income` | salary, benefit, refund | yes | no | up |
| `expense` | consumption | no | yes | down |
| `contribution` | money leaving cash to become an investment | no | **no** | neutral |
| `redemption` | money coming back from an investment to cash | **no** | no | neutral |
| `transfer` | money moving between accounts | no | no | neutral |

**A contribution is not an expense.** If it were, the savings rate would punish
the user for investing. **A redemption is not income.** It is the user's own
money coming back; counting it would inflate the savings rate.

A contribution has **one side in cash** (the source account) and its other
side in the portfolio: it is split across one or more **assets** (§5.7). A
redemption is the mirror: the cash account that receives the money, and the
assets it came out of. Neither has a counter *account* — there is no
"brokerage account" in the model. Where an asset is held is the asset's
`broker` text.

**A planned contribution needs no asset; a settled one always does.** The
amount is decided when the month is planned ("R$ 1.000 on the 5th"); the
destination is decided when the money actually moves ("all of it into fixed
income this month, half crypto the next"). Settling a contribution therefore
asks for its **allocation** — a list of `(asset, amount)` whose sum equals the
entry's amount — and records one `contribution` movement per asset, paired to
the entry. Unsettling removes them. The same holds for redemptions, with
`withdrawal` movements. A settled contribution whose paired movements do not
add up to its amount is a defect the Portfolio must point at, never hide.

**Paying a credit card statement is a `transfer`** from a cash account to the
card account. The expense was already recorded on the purchase date. Counting
the payment as an expense double counts everything.

### 5.3 Planned and settled

Every entry has a `status`:

- `planned` — it will happen (bill to pay, income to receive, future
  installment, generated recurrence);
- `settled` — it happened, and `settled_on` is filled.

Derived, never stored: **overdue** (`planned` and `date < today`), **upcoming**
(`planned` and `date >= today`).

`date` is the competence date (when it happens / falls due). `settled_on` is
when the money actually moved. They diverge, and that matters: statements close
by competence, cash moves on settlement.

Database-enforced invariant: `status = 'settled'` ⇔ `settled_on is not null`.

**Settling is the most used operation in the app.** One tap, from any screen an
entry appears on, with undo.

### 5.4 Installments

An installment purchase creates **N entries at once**, sharing an
`installment_group_id`, numbered `1..N`, one per month, `planned` (the first may
be born settled). This is what makes the cash-flow projection real: the whole
commitment is visible the day it is signed.

Editing or deleting offers three scopes: this one, this and future, all.
Implement the expansion as a pure function in `domain/installments.ts`.

### 5.5 Recurrences

A recurrence is a **template**, not an entry. Each month the user runs "generate
month" and the template becomes N `planned` entries. Never sum recurrences into
a realised report — they only feed fixed cost and projection.

Generation is **idempotent**: a unique index on `(recurrence_id, period)` plus
`on conflict do nothing`. Running it twice creates nothing the second time, and
the service returns how many rows it created.

Day-of-month clamping: due day 31 becomes the last day of a short month. Pure
function, unit tested against February.

A template can be told **"not this month"** while applying (a holiday month
with no meal voucher): the month is recorded on the template
(`skipped_periods`), the other lines are created, and that month stops
asking for it everywhere, with an undo on the Review card.

A recurring contribution may carry a **default split**: percentages per asset
summing to 100 (`recurrence_allocations`). It is a suggestion, not data: the
generated entry is planned and unallocated; the split pre-fills the allocation
when that entry is settled, where it can be changed for the month. Amounts are
derived from the percentages by largest remainder, so they always add up.

### 5.6 Credit cards — plural

**The user has more than one credit card.** Nothing in the model, the UI or the
queries may assume a single card.

- A card is an `account` with `type = 'credit_card'`, its own `closing_day`,
  `due_day` and `credit_limit_cents`.
- An expense whose `account_id` is a card belongs to that card's statement for
  the cycle containing the purchase date. Cycle resolution is a pure function in
  `domain/statements.ts`: given `closing_day`, `due_day` and a purchase date it
  returns `{ cycleStart, cycleEnd, dueDate }`.
- `statements` rows are created lazily when first needed, one per
  `(account_id, cycle_start)`.
- A card's balance is the sum of its unpaid statement entries. It is **debt**,
  not cash, and never appears in the cash figure.
- The UI shows cards side by side, each with its open statement total, due date
  and days remaining. Aggregate card debt sums across all cards.
- A card purchase is settled the day it is made, whether typed by hand or
  applied from a recurrence; only installment parts wait for their statement.
  The payment transfer belongs to its statement: deleting it undoes the
  payment, and it may change only its day.
- Refunds and cashback credited to the card are `income` on the card account
  and reduce the statement. A statement whose credits exceed its purchases
  asks nothing; the surplus carries into the next unpaid statement, and that
  statement's payment settles both.

### 5.7 Investments

No quotes, no average price, no market API. An asset's balance is the running
sum of its movements:

| `kind` | Sign | Purpose |
|---|---|---|
| `contribution` | + | new money; pairs with an `entries` row of kind `contribution` (one entry, one movement per asset) |
| `yield` | + | fixed-income interest, entered by hand |
| `market_adjustment` | ± | crypto/FX: difference between the broker app balance and the recorded balance |
| `withdrawal` | − | money out; pairs with an `entries` row of kind `redemption` when the cash arrives in an account |
| `fee_tax` | − | cost |

`balance = contribution + yield + market_adjustment − withdrawal − fee_tax`

The dashboard's job is to separate **how much was contributed** from **how much
it earned**. Only `market_adjustment` may be negative.

**Yield is not income.** It raises net worth and stays out of the savings-rate
denominator. If it leaks in, the metric inflates itself.

**Accounts and assets are different in nature.** An account's balance moves
only when the user moves money (an entry). An asset's balance moves on its own
— it yields, swings, gets charged — with no cash flow behind it. Modelling an
asset as an account would need entries with no counterpart, which is how yield
leaks into income. So: an account is money in liquid form; an asset is money
put to work.

### 5.8 Earmarked money

Meal vouchers and allowances arrive as income and leave as expense in the same
month, inflating both sides and distorting the savings rate. Categories carry an
`is_earmarked` flag ("this money arrives with its destination set: it will be
spent, it cannot be saved"), and the app shows **two rates**: gross, and one
that removes earmarked income from the denominator. Both the income and the
matching expenses go in the earmarked category.

The test for the flag is "could this money have been saved?". A cash
allowance the user is free to keep is plain income — it *is* capacity to save.
Only money that must be spent is earmarked, whatever form it arrives in.

### 5.9 Net worth

A manual monthly snapshot of each account's balance (cash and debt).
Investments are **not** snapshotted — they are derived from movements, otherwise
they are counted twice.

`net worth = cash + investments − debt`

A month with no snapshot renders **empty, never zero**. Zero is a lie that ruins
the chart.

### 5.10 Metric definitions

Computed in `domain/metrics.ts` from the entries of one period:

```
income            = Σ settled income
expense           = Σ settled expense
contributions     = Σ settled contribution
redemptions       = Σ settled redemption
earmarked         = Σ settled income where category.is_earmarked
leftover          = income − expense − contributions + redemptions
savingsRate       = (income − expense) / income
savingsRateExEar  = (income − expense) / (income − earmarked)
fixedCost         = Σ active expense recurrences
monthsOfRunway    = cash / fixedCost
committed         = Σ future planned entries in debt/installment categories
```

Transfers never enter any of these. Division guards against zero and returns
`null`, which the UI renders as `—`.

---

## 6. Database schema

Every table: `id uuid primary key default gen_random_uuid()`,
`user_id uuid not null references auth.users(id) on delete cascade`,
`created_at timestamptz not null default now()`,
`updated_at timestamptz not null default now()`.

### Enums

```sql
create type account_type   as enum ('checking','savings','cash','credit_card','other');
create type entry_kind     as enum ('income','expense','contribution','redemption','transfer');
create type entry_status   as enum ('planned','settled');
create type entry_source   as enum ('manual','recurrence','installment');
create type asset_class    as enum ('fixed_income','crypto','foreign_currency','stocks','reits','other');
create type movement_kind  as enum ('contribution','yield','market_adjustment','withdrawal','fee_tax');
create type balance_kind   as enum ('cash','debt');
```

### `accounts`
`name`, `type account_type`, `institution text`, `closing_day int`,
`due_day int`, `credit_limit_cents bigint`, `is_active bool default true`,
`sort_order int`.
Check: `credit_card` requires `closing_day` and `due_day` between 1 and 31;
every other type must have both null.

### `categories`
`name`, `parent_id uuid references categories(id)` (max depth 1),
`applies_to entry_kind[]`, `monthly_cap_cents bigint`,
`is_earmarked bool default false`, `color text`, `icon text`,
`is_active bool default true`, `sort_order int`.
Unique: `(user_id, parent_id, name)`.

### `recurrences`
`description`, `kind entry_kind`, `category_id`, `account_id`,
`counter_account_id`, `amount_cents bigint`, `due_day int`, `starts_on date`,
`ends_on date`, `is_variable bool`, `is_active bool default true`.

### `recurrence_allocations`
The default split of a recurring contribution (§5.5): `recurrence_id`,
`asset_id`, `share_percent int check (between 1 and 100)`.
Unique: `(recurrence_id, asset_id)`. The application checks the shares of one
recurrence sum to 100.

### `entries` — the central table

```
date                 date not null
settled_on           date
kind                 entry_kind not null
status               entry_status not null default 'planned'
amount_cents         bigint not null check (amount_cents > 0)
description          text not null
category_id          uuid references categories(id)
account_id           uuid not null references accounts(id)
counter_account_id   uuid references accounts(id)
notes                text
source               entry_source not null default 'manual'
recurrence_id        uuid references recurrences(id) on delete set null
period               date              -- first day of the month, for idempotency
installment_group_id uuid
installment_no       int
installment_total    int
statement_id         uuid references statements(id) on delete set null
```

Required constraints:

```sql
check ((status = 'settled') = (settled_on is not null))
check ((kind = 'transfer') = (counter_account_id is not null))
check (counter_account_id is distinct from account_id)
check ((installment_no is null) = (installment_group_id is null))
check (installment_no is null or installment_no <= installment_total)
check (kind not in ('income','expense') or category_id is not null)
create unique index on entries (recurrence_id, period) where recurrence_id is not null;
```

Indexes: `(user_id, date)`, `(user_id, status, date)`,
`(user_id, account_id, date)`, `(user_id, category_id, date)`,
`(installment_group_id)`, `(statement_id)`.

### `statements`
`account_id` (a card), `cycle_start date`, `cycle_end date`, `due_date date`,
`paid_on date`. Unique: `(account_id, cycle_start)`.

### `assets`
`name`, `asset_class`, `subclass text`, `broker text`, `is_active bool`.

### `asset_movements`
`asset_id`, `date date`, `kind movement_kind`, `amount_cents bigint`,
`entry_id uuid references entries(id) on delete set null`, `notes text`.
Check: `kind = 'market_adjustment' or amount_cents > 0`.
Several movements may point at one entry: a contribution split across assets
is one entry and N movements (§5.2).

### `balance_snapshots`
`period date` (first day of the month), `account_id`, `kind balance_kind`,
`amount_cents bigint`. Unique: `(user_id, period, account_id)`.

### RLS

Enabled on every table, no exceptions:

```sql
create policy "own rows" on <table>
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

RLS is defence in depth. The service layer also scopes every query by `user_id`
explicitly — never rely on RLS alone, because a future non-Supabase Postgres may
not have `auth.uid()`.

---

## 7. Screens

Bottom nav on mobile, sidebar on desktop.
Nav: **Home · Entries · Add · Net worth · More** (decided 2026-09-18: the
month is the home screen, Entries is the list it is made of, net worth is
looked at more often than the portfolio, which sits under More).

### `/login`
Email/password plus magic link. Middleware protects everything except `/login`
and `/auth/callback`.

### `/` — Home
The month (a separate Today screen existed until 2026-09-18 and was
removed: what it showed was the month's, the accounts' or the cards'
already). Month picker; the recurring entries still to apply; the summary
as one grid of cards — income, expense, contributions and fixed cost first,
then savings rate (with its ex-earmarked twin), leftover and budget; the
list of what is still planned this month, with one-tap settle and an undo
toast (settling a contribution opens its allocation first, pre-filled from
the recurrence's default split, so it is never left without a
destination); what was already settled this month, newest first, the
first ten with a link to the rest; spending through the month against
last month; per-category table with cap progress bars, red on overflow.
A switch opens a calendar year or the last 12 months instead: totals,
month by month, the budget month by month (capped spending against the
caps, within / at risk / over — discipline over months is a question
about the year), and the categories.

### `/add`
Fast entry form. Opens focused on the amount, numeric keyboard, kind as a
segmented control (expense, income, transfer, contribution; a redemption is
recorded from the Portfolio, as a withdrawal that also records the cash).

Conditional fields by kind:
- `expense` / `income`: amount, date, category, account, description,
  "already paid?" toggle (sets status and `settled_on`);
- `transfer`: amount, date, source account, counter account;
- `contribution`: amount, date, source account, and — when "already paid" is
  on — the allocation across assets (§5.2); a planned one waits for settling;
- **installments** toggle: number of parts, with a preview before saving
  ("12 × R$ 149,90, Oct/26 → Sep/27");
- **repeat monthly** toggle: creates a recurrence instead of an entry.

Remember the last used category and account to speed up repetition.

### `/entries`
Infinite list grouped by day, sticky month header. Filters: month, kind, status,
account, category, text search. Multi-select for bulk settle. Swipe right to
settle, left to edit.

### `/portfolio`
Total balance, total contributed, total earned, return on contributions. Donut
by asset class. Stacked area of contributed versus earned over time. Per-asset
list. Movement entry form: a contribution or withdrawal can record its cash
side at once (the entry of kind `contribution` / `redemption`, paired).
A warning, with a link to each entry, when a settled contribution or
redemption has no allocation or one that does not add up.

### `/net-worth`
Net worth (cash + investments − debt) with **months of runway** beside it —
cash ÷ fixed cost is a question about what you hold, not about one month.
Net worth line. Monthly snapshot form listing every active account at once.
Banner when the current month has no snapshot.

### `/cards`
One section per credit card: the open statement with its entries, closing and
due dates, past statements with their paid status, and a "pay statement" action
that creates the transfer.

### `/recurrences`
CRUD; a recurring contribution takes its default split here. **Monthly fixed
cost** summed at the top — the number that sizes the
emergency fund. **Generate month** with a period picker, a preview of what will
be created, and a warning when it was already generated.

### `/settings`
Accounts (with per-card closing and due days), categories and caps (with
`is_earmarked`, explained with the meal-voucher example), assets (with the
broker they are held at), profile, sign out.

---

## 8. UI requirements

- Currency input with a mask that accepts typing cents directly; store cents.
- `date` columns for competence — never `timestamptz` for "the 5th", or it
  becomes the 4th at midnight.
- Red for negative, green for positive, only where the sign carries meaning.
- Dark mode via `next-themes`, following the system preference.
- Skeletons while loading, never a full-screen spinner.
- Optimistic settle with `useOptimistic` and rollback on error.
- Empty states with an action, not just a sentence.
- Confirmation on destructive actions; deleting installments asks for scope.
- Touch targets ≥ 44px, visible focus, real labels.
- **Tested at 360px wide.** If it breaks at 360, it is broken.

---

## 9. Project structure

```
app/
  (auth)/login/
  (app)/
    page.tsx                      # Today
    add/ entries/ month/ portfolio/ net-worth/ cards/ recurrences/ settings/
    layout.tsx
  api/
    entries/ recurrences/ summary/ statements/
  auth/callback/route.ts
lib/
  domain/        money.ts dates.ts installments.ts recurrences.ts
                 statements.ts metrics.ts types.ts
  repositories/  entries.ts accounts.ts categories.ts recurrences.ts
                 assets.ts movements.ts snapshots.ts statements.ts
  services/      entries.ts recurrences.ts portfolio.ts netWorth.ts summary.ts
  schemas/       zod, shared
  auth/          supabase-specific
  db/            client factory, supabase-specific
components/
  ui/ entries/ charts/ layout/
supabase/migrations/
PORTABILITY.md
```

---

## 10. Seed

On user creation, seed an editable starting set — **no entries**:

- Accounts: `Conta Corrente`, `Dinheiro`, `Reserva`. No brokerage account:
  investments are assets (§5.7), and where they are held is the asset's
  `broker`.
- Categories: `Moradia`, `Alimentação`, `Transporte`, `Saúde`, `Educação`,
  `Assinaturas`, `Lazer`, `Dívidas e parcelas` (expense); `Salário`,
  `Extras`, `Reembolso`, `Cashback` (income); `Vale-refeição` (both,
  earmarked); `Outros` (both) — all with null caps. An existing account can
  add the starter categories it lacks from Settings.

Seed names are user data, so they are in Portuguese. Credit cards are not
seeded: the user adds their own, and there will be several.

Implement seeding as a service called after sign-up, not as a database trigger
(§4.1).

---

## 11. Build order

Ship in working stages, committing at each one. Do not build everything and
reveal it at the end.

1. Project, Tailwind, shadcn, Supabase local, first migration: enums, tables,
   constraints, indexes, RLS.
2. `domain/` with unit tests — money, date clamping, installment expansion,
   statement cycles, metrics. **Tests before any UI.**
3. Auth (login, callback, middleware, sign out) plus the app shell and nav.
4. Repositories and services for accounts and categories, `/settings`, seed.
5. `/add` and `/entries`, including installments and settling.
6. `/month` on top of `domain/metrics.ts`.
7. `/recurrences` and month generation.
8. `/cards`: multi-card, statement cycles, pay-statement action.
9. Assets, movements, `/portfolio`.
10. Snapshots, `/net-worth`.
11. `/` (Today).
12. `app/api/` handlers over the existing services.
13. Polish: dark mode, empty states, skeletons, 360px pass, `PORTABILITY.md`.

---

## 12. Acceptance criteria

Write tests that prove each of these. Items 1–12 and 14–15 are unit tests
against `domain/` and `services/` with a fake repository; item 13 needs a real
database and two JWTs.

1. A contribution never appears in the expense total.
2. A transfer appears in neither income nor expense.
3. Paying a card statement is not an expense; the original purchase is.
4. Investment yield enters neither income nor the savings rate.
5. `savingsRateExEarmarked` excludes `is_earmarked` categories from the denominator.
6. Generating the same month twice creates nothing the second time.
7. A recurrence whose `ends_on` precedes the month generates nothing; likewise
   one whose `starts_on` follows it.
8. Due day 31 produces 28 or 29 in February.
9. A 12× purchase creates 12 numbered entries, one per month, one group id.
10. `status = 'settled'` without `settled_on` is rejected by the database.
11. Asset balance honours the signs of all five movement kinds.
12. A month without a snapshot returns `null` net worth, not `0`.
13. User A can neither read nor write user B's rows.
14. Two cards with different closing days resolve the same purchase date to
    different statement cycles, and a purchase after the closing day lands in
    the next cycle.
15. Total card debt sums every card and excludes paid statements.
16. Settling a contribution with an allocation creates one paired movement per
    asset whose amounts sum to the entry; unsettling removes them; an
    allocation that does not add up is rejected.
17. A redemption raises the cash account and enters neither income nor the
    savings rate; a contribution lowers it and enters neither expense nor the
    rate.
18. A default split of 70/30 over R$ 1.000,01 allocates amounts that sum to
    exactly R$ 1.000,01.

---

## 13. Deliverables

- `README.md`: local setup with the Supabase CLI, env vars, migrations, deploy.
- `PORTABILITY.md`: what leaving Supabase would touch.
- `.env.example` with `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- No secrets committed. `npm run build` clean, no TypeScript errors, no loose
  `any`.

---

## 14. How to work

- Ask before deviating from this spec. Prefer asking to inventing.
- When a rule here is ambiguous, resolve it by this principle: **the app must
  never count money twice, and must never pretend to know a number it does not
  have.**
- Small commits, English, imperative mood.
- After each stage in §11, report in two or three lines what is done and what
  is left.
