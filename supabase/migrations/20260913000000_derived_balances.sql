-- Balances are derived (decided 2026-09-13, replacing PROMPT.md §5.9's manual
-- snapshots): an account starts at `opening_balance_cents` on `opening_on`
-- and every settled entry from then on moves it. A forgotten expense is
-- recorded as an entry, not as a correction table. Net worth is computed
-- from accounts, unpaid statements and asset movements for any month.

alter table accounts
  add column opening_balance_cents bigint not null default 0,
  add column opening_on date not null default current_date;

drop table balance_snapshots;
drop type balance_kind;
