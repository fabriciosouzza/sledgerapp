-- A goal is a savings account with a target (review 2026-09-13, M13):
-- "R$ 9.200 of R$ 15.000 · R$ 5.800 to go" on its tile. No new table.
alter table accounts add column target_cents bigint;
alter table accounts add constraint accounts_target_positive check (target_cents is null or target_cents > 0);
