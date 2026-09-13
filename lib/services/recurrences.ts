// Recurrences (PROMPT.md §5.5): templates, never summed into realised
// reports; "generate month" turns them into planned entries, idempotently.

import { isCreditCard } from "@/lib/domain/accounts";
import { appliesToKind } from "@/lib/domain/categories";
import { needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { expandRecurrences, monthlyFixedCost } from "@/lib/domain/recurrences";
import { addMonths, periodEnd, periodOf, periodStart } from "@/lib/domain/dates";
import type { Entry, IsoDate, NewEntry, Period, Recurrence } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import type { RecurrenceInput } from "@/lib/schemas/recurrences";
import { ServiceError } from "./errors";

export async function listRecurrences(repos: Repositories, userId: string): Promise<Recurrence[]> {
  return repos.recurrences.list(userId);
}

export async function getRecurrence(repos: Repositories, userId: string, id: string): Promise<Recurrence> {
  const recurrence = await repos.recurrences.getById(userId, id);
  if (!recurrence) throw new ServiceError("not_found", "Recurrence not found.");
  return recurrence;
}

export async function fixedCost(repos: Repositories, userId: string): Promise<number> {
  return monthlyFixedCost(await repos.recurrences.list(userId));
}

async function fields(repos: Repositories, userId: string, input: RecurrenceInput): Promise<Omit<Recurrence, "id">> {
  const kind = input.kind;
  const categoryId = needsCategory(kind) ? input.categoryId : null;
  const counterAccountId = needsCounterAccount(kind) ? input.counterAccountId : null;

  const account = await repos.accounts.getById(userId, input.accountId);
  if (!account) throw new ServiceError("invalid", "Account not found.");
  if (counterAccountId !== null) {
    const counter = await repos.accounts.getById(userId, counterAccountId);
    if (!counter) throw new ServiceError("invalid", "Destination account not found.");
    if (kind === "contribution" && counter.type !== "brokerage") throw new ServiceError("invalid", "A contribution goes to a brokerage account.");
    if (kind === "transfer" && isCreditCard(account)) throw new ServiceError("invalid", "A card is paid from a cash account into the card.");
  }
  if (categoryId !== null) {
    const category = await repos.categories.getById(userId, categoryId);
    if (!category) throw new ServiceError("invalid", "Category not found.");
    if (!appliesToKind(category, kind)) throw new ServiceError("invalid", `"${category.name}" does not apply to ${kind}.`);
  }
  if (input.dueDay === null) throw new ServiceError("invalid", "Pick the due day.");

  return {
    description: input.description,
    kind,
    categoryId,
    accountId: input.accountId,
    counterAccountId,
    amountCents: input.amountCents,
    dueDay: input.dueDay,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    isVariable: input.isVariable,
    isActive: input.isActive,
  };
}

export async function createRecurrence(repos: Repositories, userId: string, input: RecurrenceInput): Promise<Recurrence> {
  return repos.recurrences.insert(userId, await fields(repos, userId, input));
}

export async function updateRecurrence(repos: Repositories, userId: string, id: string, input: RecurrenceInput): Promise<Recurrence> {
  await getRecurrence(repos, userId, id);
  return repos.recurrences.update(userId, id, await fields(repos, userId, input));
}

export async function setRecurrenceActive(repos: Repositories, userId: string, id: string, isActive: boolean): Promise<Recurrence> {
  await getRecurrence(repos, userId, id);
  return repos.recurrences.update(userId, id, { isActive });
}

/** Entries already generated keep their rows; `recurrence_id` becomes null (FK on delete set null). */
export async function deleteRecurrence(repos: Repositories, userId: string, id: string): Promise<void> {
  await getRecurrence(repos, userId, id);
  // Generated entries would lose their link and a re-created template could
  // double a month: a template that already ran is deactivated, not deleted.
  const generated = await repos.entries.list(userId, { recurrenceId: id });
  if (generated.length > 0) throw new ServiceError("in_use", "This recurrence already generated entries. Deactivate it instead.");
  await repos.recurrences.delete(userId, id);
}

export interface GenerationPreview {
  period: Period;
  /** What a run would create now. */
  toCreate: (NewEntry & { recurrence: Recurrence })[];
  /** Already present for this period, from an earlier run. */
  existing: Entry[];
}

export async function previewGeneration(repos: Repositories, userId: string, period: Period): Promise<GenerationPreview> {
  const [recurrences, entries] = await Promise.all([repos.recurrences.list(userId), repos.entries.list(userId, { period })]);
  return previewFrom(recurrences, entries, period);
}

/** Pure: `entries` are the period's rows (extra rows from other periods are ignored). */
function previewFrom(recurrences: Recurrence[], entries: Entry[], period: Period): GenerationPreview {
  const existing = entries.filter((e) => e.recurrenceId !== null && periodOf(e.date) === period);
  const done = new Set(existing.map((e) => e.recurrenceId));
  const byId = new Map(recurrences.map((r) => [r.id, r]));
  const toCreate = expandRecurrences(recurrences, period)
    .filter((row) => !done.has(row.recurrenceId))
    .map((row) => ({ ...row, recurrence: byId.get(row.recurrenceId!)! }));
  return { period, toCreate, existing };
}

export interface PendingMonth {
  period: Period;
  /** Still to apply. */
  count: number;
  /** Already applied that month. */
  applied: number;
}

/** Months from `lookback` ago up to the current one that still have recurring entries to apply, oldest first. Two queries, not two per month. */
export async function pendingMonths(repos: Repositories, userId: string, today: IsoDate, lookback = 3): Promise<PendingMonth[]> {
  const current = periodOf(today);
  const first = addMonths(current, -lookback);
  const [recurrences, entries] = await Promise.all([
    repos.recurrences.list(userId),
    repos.entries.list(userId, { from: periodStart(first), to: periodEnd(current) }),
  ]);
  const out: PendingMonth[] = [];
  for (let i = lookback; i >= 0; i--) {
    const period = addMonths(current, -i);
    const preview = previewFrom(recurrences, entries, period);
    if (preview.toCreate.length > 0) out.push({ period, count: preview.toCreate.length, applied: preview.existing.length });
  }
  return out;
}

export interface GenerationResult {
  period: Period;
  created: number;
  skipped: number;
}

/**
 * Idempotent (§5.5): the unique index on (recurrence_id, period) makes a second
 * run a no-op. `amounts` overrides a template's amount for this month only —
 * the water bill is never the same twice; the template keeps its estimate.
 */
export async function generateMonth(
  repos: Repositories,
  userId: string,
  period: Period,
  amounts: Record<string, number> = {},
  skip: string[] = [],
): Promise<GenerationResult> {
  const recurrences = await repos.recurrences.list(userId);
  const skipped = new Set(skip);
  const rows = expandRecurrences(recurrences, period)
    .filter((row) => row.recurrenceId === null || !skipped.has(row.recurrenceId))
    .map((row) => {
    const override = row.recurrenceId === null ? undefined : amounts[row.recurrenceId];
    if (override === undefined) return row;
    if (!Number.isInteger(override) || override <= 0) throw new ServiceError("invalid", "Amounts must be positive.");
    return { ...row, amountCents: override };
    });
  const inserted = await repos.entries.insertMany(userId, rows, { ignoreConflicts: true });
  return { period, created: inserted.length, skipped: rows.length - inserted.length };
}
