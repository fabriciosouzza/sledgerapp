// Recurrences (PROMPT.md §5.5): templates, never summed into realised
// reports; "generate month" turns them into planned entries, idempotently.

import { isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { sharesProblem } from "@/lib/domain/allocation";
import { appliesToKind } from "@/lib/domain/categories";
import { needsAllocation, needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { expandRecurrence, expandRecurrences, isSkippedIn, monthlyFixedCost, recurrenceOccursIn } from "@/lib/domain/recurrences";
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

/** Everything the form sets; the skipped months belong to the template's history and are never overwritten by an edit. */
async function fields(repos: Repositories, userId: string, input: RecurrenceInput): Promise<Omit<Recurrence, "id" | "skippedPeriods">> {
  const kind = input.kind;
  const categoryId = needsCategory(kind) ? input.categoryId : null;
  const counterAccountId = needsCounterAccount(kind) ? input.counterAccountId : null;

  const account = await repos.accounts.getById(userId, input.accountId);
  if (!account) throw new ServiceError("invalid", "Account not found.");
  if (needsAllocation(kind) && !isCashAccount(account)) throw new ServiceError("invalid", "A contribution leaves a cash account.");
  if (counterAccountId !== null) {
    const counter = await repos.accounts.getById(userId, counterAccountId);
    if (!counter) throw new ServiceError("invalid", "Destination account not found.");
    if (kind === "transfer" && isCreditCard(account)) throw new ServiceError("invalid", "A card is paid from a cash account into the card.");
  }
  // The default split (§5.5): a suggestion for settling, so it must at least add up and name real assets.
  const allocations = needsAllocation(kind) ? input.allocations : [];
  const problem = sharesProblem(allocations);
  if (problem) throw new ServiceError("invalid", problem);
  if (allocations.length > 0) {
    const assets = new Set((await repos.assets.list(userId)).map((a) => a.id));
    for (const share of allocations) if (!assets.has(share.assetId)) throw new ServiceError("invalid", "Asset not found.");
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
    allocations,
  };
}

export async function createRecurrence(repos: Repositories, userId: string, input: RecurrenceInput): Promise<Recurrence> {
  return repos.recurrences.insert(userId, { ...(await fields(repos, userId, input)), skippedPeriods: [] });
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
  /** Told "not this month" and not generated: offered again only on undo. */
  skipped: Recurrence[];
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
  const skipped = recurrences.filter((r) => recurrenceOccursIn(r, period) && isSkippedIn(r, period) && !done.has(r.id));
  return { period, toCreate, existing, skipped };
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
 * `skip` is remembered on each template: that month stops asking to be applied.
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
  const rows = await settleCardRows(
    repos,
    userId,
    expandRecurrences(recurrences, period)
      .filter((row) => row.recurrenceId === null || !skipped.has(row.recurrenceId))
      .map((row) => {
        const override = row.recurrenceId === null ? undefined : amounts[row.recurrenceId];
        if (override !== undefined && (!Number.isInteger(override) || override <= 0)) throw new ServiceError("invalid", "Amounts must be positive.");
        return override === undefined ? row : { ...row, amountCents: override };
      }),
  );
  const inserted = await repos.entries.insertMany(userId, rows, { ignoreConflicts: true });
  const start = periodStart(period);
  for (const r of recurrences) {
    if (skipped.has(r.id) && recurrenceOccursIn(r, period) && !r.skippedPeriods.includes(start)) {
      await repos.recurrences.update(userId, r.id, { skippedPeriods: [...r.skippedPeriods, start] });
    }
  }
  return { period, created: inserted.length, skipped: rows.length - inserted.length };
}

export type MonthRecurrenceState = "applied" | "pending" | "skipped";

export interface MonthRecurrence {
  recurrence: Recurrence;
  state: MonthRecurrenceState;
  /** The generated entry, when applied. */
  entry: Entry | null;
}

/** Every template that occurs in `period`, with where it stands — the month's management sheet. */
export async function monthRecurrences(repos: Repositories, userId: string, period: Period): Promise<MonthRecurrence[]> {
  const [recurrences, entries] = await Promise.all([repos.recurrences.list(userId), repos.entries.list(userId, { period })]);
  const byRecurrence = new Map(entries.filter((e) => e.recurrenceId !== null).map((e) => [e.recurrenceId!, e]));
  return recurrences
    .filter((r) => recurrenceOccursIn(r, period))
    .map((recurrence) => {
      const entry = byRecurrence.get(recurrence.id) ?? null;
      const state: MonthRecurrenceState = entry ? "applied" : isSkippedIn(recurrence, period) ? "skipped" : "pending";
      return { recurrence, state, entry };
    });
}

/** A card purchase counts the day it is made, recurring or not (§5.6). */
async function settleCardRows(repos: Repositories, userId: string, rows: NewEntry[]): Promise<NewEntry[]> {
  const cards = new Set((await repos.accounts.list(userId)).filter(isCreditCard).map((a) => a.id));
  return rows.map((row) => (cards.has(row.accountId) && (row.kind === "expense" || row.kind === "income") ? { ...row, status: "settled" as const, settledOn: row.date } : row));
}

/** Brings one template into the month in one go: forgets "not this month" and creates its planned entry (a no-op when it is there already). */
export async function includeRecurrenceInMonth(repos: Repositories, userId: string, id: string, period: Period): Promise<Entry | null> {
  const recurrence = await getRecurrence(repos, userId, id);
  if (!recurrenceOccursIn(recurrence, period)) throw new ServiceError("invalid", "This recurrence does not fall in that month.");
  const start = periodStart(period);
  if (recurrence.skippedPeriods.includes(start)) await repos.recurrences.update(userId, id, { skippedPeriods: recurrence.skippedPeriods.filter((p) => p !== start) });
  const rows = await settleCardRows(repos, userId, [expandRecurrence(recurrence, period)]);
  const [created] = await repos.entries.insertMany(userId, rows, { ignoreConflicts: true });
  return created ?? null;
}

/**
 * Takes one template out of the month: its planned entry goes (a settled one
 * stays — it happened) and the month is remembered as "not this month".
 */
export async function excludeRecurrenceFromMonth(repos: Repositories, userId: string, id: string, period: Period): Promise<void> {
  const recurrence = await getRecurrence(repos, userId, id);
  const existing = (await repos.entries.list(userId, { recurrenceId: id })).find((e) => e.period === periodStart(period));
  if (existing) {
    if (existing.status === "settled") throw new ServiceError("invalid", `${recurrence.description} was already settled this month; undo that first.`);
    await repos.entries.deleteMany(userId, [existing.id]);
  }
  const start = periodStart(period);
  if (!recurrence.skippedPeriods.includes(start)) await repos.recurrences.update(userId, id, { skippedPeriods: [...recurrence.skippedPeriods, start] });
}
