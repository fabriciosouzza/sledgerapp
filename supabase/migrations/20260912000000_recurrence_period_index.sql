-- Idempotent month generation (PROMPT.md §5.5) relies on `on conflict
-- (recurrence_id, period) do nothing`. A partial unique index cannot be the
-- arbiter of that clause unless the statement repeats its predicate, which
-- PostgREST's upsert does not. A plain unique index is equivalent here: NULLs
-- are distinct, so manual entries (recurrence_id null) never collide.

drop index if exists entries_recurrence_period_key;
create unique index entries_recurrence_period_key on entries (recurrence_id, period);
