-- Review of 2026-09-13 (docs/review-2026-09-13.md, C6–C8).
--
-- 1. Derived balances filter by settled_on; every index so far was by date.
create index entries_user_settled_idx on entries (user_id, settled_on) where status = 'settled';

-- 2. Foreign keys carry the owner: an entry can only point at its own user's
--    category and accounts, whatever the caller does. The parents get a
--    (id, user_id) key for the composite references to target.
alter table accounts   add constraint accounts_id_user_key   unique (id, user_id);
alter table categories add constraint categories_id_user_key unique (id, user_id);
alter table assets     add constraint assets_id_user_key     unique (id, user_id);
alter table statements add constraint statements_id_user_key unique (id, user_id);

alter table entries
  drop constraint entries_category_id_fkey,
  drop constraint entries_account_id_fkey,
  drop constraint entries_counter_account_id_fkey,
  drop constraint entries_statement_id_fkey,
  add constraint entries_category_fkey        foreign key (category_id, user_id)        references categories (id, user_id),
  add constraint entries_account_fkey         foreign key (account_id, user_id)         references accounts (id, user_id),
  add constraint entries_counter_account_fkey foreign key (counter_account_id, user_id) references accounts (id, user_id),
  add constraint entries_statement_fkey       foreign key (statement_id, user_id)       references statements (id, user_id) on delete set null;

alter table recurrences
  drop constraint recurrences_category_id_fkey,
  drop constraint recurrences_account_id_fkey,
  drop constraint recurrences_counter_account_id_fkey,
  add constraint recurrences_category_fkey        foreign key (category_id, user_id)        references categories (id, user_id),
  add constraint recurrences_account_fkey         foreign key (account_id, user_id)         references accounts (id, user_id),
  add constraint recurrences_counter_account_fkey foreign key (counter_account_id, user_id) references accounts (id, user_id);

alter table statements
  drop constraint statements_account_id_fkey,
  add constraint statements_account_fkey foreign key (account_id, user_id) references accounts (id, user_id);

alter table asset_movements
  drop constraint asset_movements_asset_id_fkey,
  add constraint asset_movements_asset_fkey foreign key (asset_id, user_id) references assets (id, user_id);

-- 3. Two accounts with the same name only confuse; it also makes the sign-in
--    seed safe to run twice (insert ... on conflict do nothing).
alter table accounts add constraint accounts_user_name_key unique (user_id, name);

alter table categories
  drop constraint categories_parent_id_fkey,
  add constraint categories_parent_fkey foreign key (parent_id, user_id) references categories (id, user_id);
