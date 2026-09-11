-- sledger — initial schema.
--
-- Postgres is storage, not logic (PROMPT.md §4.1): tables, constraints, indexes
-- and RLS. No views, no functions carrying rules, no triggers except updated_at.
-- Money is integer cents; `kind` carries the sign (§5.1).

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type account_type  as enum ('checking', 'savings', 'cash', 'credit_card', 'brokerage', 'other');
create type entry_kind    as enum ('income', 'expense', 'contribution', 'transfer');
create type entry_status  as enum ('planned', 'settled');
create type entry_source  as enum ('manual', 'recurrence', 'installment');
create type asset_class   as enum ('fixed_income', 'crypto', 'foreign_currency', 'stocks', 'reits', 'other');
create type movement_kind as enum ('contribution', 'yield', 'market_adjustment', 'withdrawal', 'fee_tax');
create type balance_kind  as enum ('cash', 'debt');

-- ─── updated_at (the only trigger allowed) ──────────────────────────────────

create function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── accounts ───────────────────────────────────────────────────────────────

create table accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  type               account_type not null,
  institution        text,
  closing_day        int,
  due_day            int,
  credit_limit_cents bigint,
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- A card needs both cycle days; every other type must have neither.
  -- The explicit `is not null` matters: a NULL check result passes.
  constraint accounts_card_days check (
    case when type = 'credit_card'
      then closing_day is not null and closing_day between 1 and 31
       and due_day is not null and due_day between 1 and 31
      else closing_day is null and due_day is null
    end
  ),
  constraint accounts_credit_limit_positive check (credit_limit_cents is null or credit_limit_cents > 0)
);

create index accounts_user_idx on accounts (user_id);

-- ─── categories ─────────────────────────────────────────────────────────────

create table categories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  -- Max depth 1 is enforced in lib/domain: a check cannot look at another row.
  parent_id         uuid references categories (id),
  applies_to        entry_kind[],
  monthly_cap_cents bigint,
  is_benefit        boolean not null default false,
  color             text,
  icon              text,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint categories_not_own_parent check (parent_id is distinct from id),
  constraint categories_cap_positive check (monthly_cap_cents is null or monthly_cap_cents > 0),
  -- NULLS NOT DISTINCT so two top-level categories cannot share a name.
  constraint categories_user_parent_name_key unique nulls not distinct (user_id, parent_id, name)
);

-- ─── recurrences ────────────────────────────────────────────────────────────
-- A template, not an entry (§5.5). Same shape rules as entries, so every row
-- generated from a recurrence is valid.

create table recurrences (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  description        text not null,
  kind               entry_kind not null,
  category_id        uuid references categories (id),
  account_id         uuid not null references accounts (id),
  counter_account_id uuid references accounts (id),
  amount_cents       bigint not null,
  due_day            int not null,
  starts_on          date not null,
  ends_on            date,
  is_variable        boolean not null default false,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint recurrences_amount_positive check (amount_cents > 0),
  constraint recurrences_due_day check (due_day between 1 and 31),
  constraint recurrences_counter_account check ((kind in ('transfer', 'contribution')) = (counter_account_id is not null)),
  constraint recurrences_distinct_accounts check (counter_account_id is distinct from account_id),
  constraint recurrences_category check (kind not in ('income', 'expense') or category_id is not null),
  constraint recurrences_dates check (ends_on is null or ends_on >= starts_on)
);

create index recurrences_user_idx on recurrences (user_id);

-- ─── statements ─────────────────────────────────────────────────────────────
-- One per (card, cycle), created lazily (§5.6).

create table statements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references accounts (id),
  cycle_start date not null,
  cycle_end   date not null,
  due_date    date not null,
  paid_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint statements_cycle check (cycle_end >= cycle_start),
  constraint statements_account_cycle_key unique (account_id, cycle_start)
);

create index statements_user_due_idx on statements (user_id, due_date);

-- ─── entries — the central table ────────────────────────────────────────────

create table entries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  date                 date not null,
  settled_on           date,
  kind                 entry_kind not null,
  status               entry_status not null default 'planned',
  amount_cents         bigint not null,
  description          text not null,
  category_id          uuid references categories (id),
  account_id           uuid not null references accounts (id),
  counter_account_id   uuid references accounts (id),
  notes                text,
  source               entry_source not null default 'manual',
  recurrence_id        uuid references recurrences (id) on delete set null,
  period               date,
  installment_group_id uuid,
  installment_no       int,
  installment_total    int,
  statement_id         uuid references statements (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint entries_amount_positive check (amount_cents > 0),
  constraint entries_settled check ((status = 'settled') = (settled_on is not null)),
  constraint entries_counter_account check ((kind in ('transfer', 'contribution')) = (counter_account_id is not null)),
  constraint entries_distinct_accounts check (counter_account_id is distinct from account_id),
  constraint entries_installment_group check ((installment_no is null) = (installment_group_id is null)),
  constraint entries_installment_range check (installment_no is null or installment_no <= installment_total),
  constraint entries_category check (kind not in ('income', 'expense') or category_id is not null),
  -- Close the NULL gaps in the two installment checks above: parts are 1..N
  -- and N is always known.
  constraint entries_installment_total check ((installment_total is null) = (installment_group_id is null)),
  constraint entries_installment_no_min check (installment_no is null or installment_no >= 1),
  constraint entries_period_first_day check (period is null or extract(day from period) = 1)
);

-- Idempotent month generation (§5.5).
create unique index entries_recurrence_period_key on entries (recurrence_id, period) where recurrence_id is not null;

create index entries_user_date_idx          on entries (user_id, date);
create index entries_user_status_date_idx   on entries (user_id, status, date);
create index entries_user_account_date_idx  on entries (user_id, account_id, date);
create index entries_user_category_date_idx on entries (user_id, category_id, date);
create index entries_installment_group_idx  on entries (installment_group_id);
create index entries_statement_idx          on entries (statement_id);

-- ─── assets & movements ─────────────────────────────────────────────────────
-- Balance is the running sum of movements; no quotes (§5.7).

create table assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  asset_class asset_class not null,
  subclass    text,
  broker      text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index assets_user_idx on assets (user_id);

create table asset_movements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  asset_id     uuid not null references assets (id),
  date         date not null,
  kind         movement_kind not null,
  amount_cents bigint not null,
  entry_id     uuid references entries (id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- The only amount in the system allowed to be negative.
  constraint asset_movements_amount_sign check (kind = 'market_adjustment' or amount_cents > 0)
);

create index asset_movements_user_date_idx  on asset_movements (user_id, date);
create index asset_movements_asset_date_idx on asset_movements (asset_id, date);
create index asset_movements_entry_idx      on asset_movements (entry_id);

-- ─── balance_snapshots ──────────────────────────────────────────────────────
-- Manual monthly snapshot of cash and debt accounts. Investments are derived
-- from movements and never snapshotted (§5.9).

create table balance_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  period       date not null,
  account_id   uuid not null references accounts (id),
  kind         balance_kind not null,
  amount_cents bigint not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- `kind` carries the sign; zero is a real, known balance.
  constraint balance_snapshots_amount_non_negative check (amount_cents >= 0),
  constraint balance_snapshots_period_first_day check (extract(day from period) = 1),
  constraint balance_snapshots_user_period_account_key unique (user_id, period, account_id)
);

-- ─── updated_at triggers ────────────────────────────────────────────────────

create trigger accounts_updated_at          before update on accounts          for each row execute function set_updated_at();
create trigger categories_updated_at        before update on categories        for each row execute function set_updated_at();
create trigger recurrences_updated_at       before update on recurrences       for each row execute function set_updated_at();
create trigger statements_updated_at        before update on statements        for each row execute function set_updated_at();
create trigger entries_updated_at           before update on entries           for each row execute function set_updated_at();
create trigger assets_updated_at            before update on assets            for each row execute function set_updated_at();
create trigger asset_movements_updated_at   before update on asset_movements   for each row execute function set_updated_at();
create trigger balance_snapshots_updated_at before update on balance_snapshots for each row execute function set_updated_at();

-- ─── Row level security ─────────────────────────────────────────────────────
-- Defence in depth: services also scope every query by user_id explicitly.
-- `(select auth.uid())` is evaluated once per statement instead of per row.

alter table accounts          enable row level security;
alter table categories        enable row level security;
alter table recurrences       enable row level security;
alter table statements        enable row level security;
alter table entries           enable row level security;
alter table assets            enable row level security;
alter table asset_movements   enable row level security;
alter table balance_snapshots enable row level security;

create policy "own rows" on accounts          for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on categories        for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on recurrences       for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on statements        for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on entries           for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on assets            for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on asset_movements   for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on balance_snapshots for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
