-- Contributions have one side in cash and the other in the portfolio
-- (PROMPT.md §5.2, decided 2026-09-16). The "brokerage account" that used to
-- stand in for the destination is gone: a contribution is split across assets
-- when it is settled, one paired movement per asset. A redemption is the
-- mirror, paired with withdrawal movements. Earmarked replaces "benefit" on
-- categories: the flag is about money arriving with its destination set.

-- ─── entries and recurrences: no counter account outside transfers ──────────

-- The old rule ("a contribution has a counter account") goes first, or the
-- rows below cannot be moved to the new shape.
alter table entries     drop constraint if exists entries_counter_account;
alter table recurrences drop constraint if exists recurrences_counter_account;

-- A withdrawal recorded as a transfer out of a brokerage becomes a redemption
-- into the cash account; a transfer into one becomes a contribution.
update entries e
   set kind = 'redemption', account_id = e.counter_account_id, counter_account_id = null
  from accounts a
 where e.kind = 'transfer' and a.id = e.account_id and a.type = 'brokerage';

update entries e
   set kind = 'contribution', counter_account_id = null
  from accounts a
 where e.kind = 'transfer' and a.id = e.counter_account_id and a.type = 'brokerage';

update entries set counter_account_id = null where kind = 'contribution';

update recurrences r
   set kind = 'contribution', counter_account_id = null
  from accounts a
 where r.kind = 'transfer' and a.id = r.counter_account_id and a.type = 'brokerage';

update recurrences set counter_account_id = null where kind = 'contribution';

alter table entries     add constraint entries_counter_account     check ((kind = 'transfer') = (counter_account_id is not null));
alter table recurrences add constraint recurrences_counter_account check ((kind = 'transfer') = (counter_account_id is not null));

-- ─── accounts: the brokerage type is gone ───────────────────────────────────
-- Nothing references a brokerage account any more (the updates above moved
-- every side that did). Where an asset is held is the asset's `broker`.

delete from accounts where type = 'brokerage';

-- The card-days check compares `type` with a literal of the old enum, so it
-- is rebuilt around the type change.
alter table accounts drop constraint accounts_card_days;

alter type account_type rename to account_type_old;
create type account_type as enum ('checking', 'savings', 'cash', 'credit_card', 'other');
alter table accounts alter column type type account_type using type::text::account_type;
drop type account_type_old;

alter table accounts add constraint accounts_card_days check (
  case when type = 'credit_card'
    then closing_day is not null and closing_day between 1 and 31
     and due_day is not null and due_day between 1 and 31
    else closing_day is null and due_day is null
  end
);

-- ─── categories: earmarked, not "benefit" ───────────────────────────────────

alter table categories rename column is_benefit to is_earmarked;

-- ─── recurrence_allocations: the default split of a recurring contribution ──
-- A suggestion for settling, not data (§5.5): percentages per asset, and the
-- application checks that one recurrence's shares sum to 100.

alter table recurrences add constraint recurrences_id_user_key unique (id, user_id);

create table recurrence_allocations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  recurrence_id uuid not null,
  asset_id      uuid not null,
  share_percent int not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint recurrence_allocations_share check (share_percent between 1 and 100),
  constraint recurrence_allocations_recurrence_fkey foreign key (recurrence_id, user_id) references recurrences (id, user_id) on delete cascade,
  constraint recurrence_allocations_asset_fkey foreign key (asset_id, user_id) references assets (id, user_id),
  constraint recurrence_allocations_recurrence_asset_key unique (recurrence_id, asset_id)
);

create index recurrence_allocations_user_idx on recurrence_allocations (user_id);

create trigger recurrence_allocations_updated_at before update on recurrence_allocations for each row execute function set_updated_at();

alter table recurrence_allocations enable row level security;
create policy "own rows" on recurrence_allocations for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
