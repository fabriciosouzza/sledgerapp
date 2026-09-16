-- A redemption is the mirror of a contribution (PROMPT.md §5.2, decided
-- 2026-09-16): the user's own money coming back from an investment to cash.
-- Not income, neutral for net worth. Added on its own: a value added to an
-- enum cannot be used in the transaction that adds it.

alter type entry_kind add value 'redemption' before 'transfer';
