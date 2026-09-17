-- A recurrence can be told "not this month" (decided 2026-09-17): a month on
-- holiday has no meal voucher, and the template must stop asking to be
-- applied to it. Each element is the first day of a month, like `period`
-- on entries; the application keeps the list unique.

alter table recurrences add column skipped_periods date[] not null default '{}';
