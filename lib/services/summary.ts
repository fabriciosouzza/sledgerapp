// Month summary (PROMPT.md §5.10, §7 /review): metrics computed in TypeScript
// from one period's rows. Cash is the derived balance at the period's end;
// with no cash account yet, runway is unknown, not zero.

import { addMonths, parseIsoDate, periodEnd, periodOf, periodRange, periodStart, today as todayInSaoPaulo } from "@/lib/domain/dates";
import {
  budgetFromCaps,
  budgetStatus,
  cappedExpenseCents,
  computeMetrics,
  dailyCumulativeExpense,
  spendingByCategory,
  type BudgetStatus,
  type CategorySpending,
  type PeriodMetrics,
} from "@/lib/domain/metrics";
import type { Category, Entry, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { cashAtPeriod } from "./netWorth";

export interface CategoryLine extends Omit<CategorySpending, "children"> {
  name: string;
  isActive: boolean;
  icon: string | null;
  color: string | null;
  children: CategoryLine[];
}

export interface BudgetMonth {
  period: Period;
  /** Settled expense, all of it. */
  expenseCents: number;
  /** The part in capped categories: what the budget measures. */
  spentCents: number;
  budgetCents: number | null;
  /** From `spentCents`: spending without a cap has no budget to exceed. */
  status: BudgetStatus | null;
}

export interface MonthSummary {
  period: Period;
  metrics: PeriodMetrics;
  categories: CategoryLine[];
  planned: Entry[];
  entries: Entry[];
  /** Σ category caps (DESIGN.md §5); `null` without caps. */
  budgetCents: number | null;
  /** Settled expense in capped categories, the part the budget measures. */
  budgetSpentCents: number;
  /** Installment parts falling in this month — committed before any choice, like the fixed cost. */
  installmentsCents: number;
  budgetStatus: BudgetStatus | null;
  /** Settled expense accumulated per day, this month and the previous one. */
  dailySpend: { current: number[]; previous: number[] };
  /**
   * Change vs the previous month, `null` when that month has nothing to compare.
   * For the current month the previous one is cut at the same day (`throughDay`), so
   * a half month is not compared with a whole one.
   */
  delta: { income: number | null; expense: number | null; throughDay: number | null };
  /** Last month's metrics, cut the same way. `null` when it has no entries. */
  previous: PeriodMetrics | null;
}

/** Capped categories past their cap, sub-categories included: the month's actionable news. */
export function capsOver(lines: CategoryLine[]): { name: string; overCents: number }[] {
  return lines
    .flatMap((line) => [line, ...line.children])
    .filter((line) => line.capCents !== null && line.settledCents > line.capCents)
    .map((line) => ({ name: line.name, overCents: line.settledCents - (line.capCents ?? 0) }));
}

export async function monthSummary(
  repos: Repositories,
  userId: string,
  period: Period,
  options: { today?: IsoDate; cashCents?: number | null } = {},
): Promise<MonthSummary> {
  const previousPeriod = addMonths(period, -1);
  const [entries, categories, recurrences, cashCents, previousAll] = await Promise.all([
    repos.entries.list(userId, { period }),
    repos.categories.list(userId),
    repos.recurrences.list(userId),
    options.cashCents !== undefined ? options.cashCents : cashAtPeriod(repos, userId, period, options.today ?? todayInSaoPaulo()),
    // The previous month, whole: the comparison and the grey daily line (the year views hold longer runs).
    repos.entries.list(userId, { period: previousPeriod }),
  ]);
  // A month in progress is compared with the previous one up to the same day.
  const today = options.today ?? todayInSaoPaulo();
  const throughDay = periodOf(today) === period ? parseIsoDate(today).day : null;
  const previousEntries = throughDay === null ? previousAll : previousAll.filter((e) => parseIsoDate(e.date).day <= throughDay);
  const previous = previousEntries.length > 0 ? computeMetrics({ entries: previousEntries, categories, recurrences: [], cashCents: null }) : null;

  const metrics = computeMetrics({ entries, categories, recurrences, cashCents });
  const byId = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const bySize = (a: CategoryLine, b: CategoryLine) => b.settledCents + b.plannedCents - (a.settledCents + a.plannedCents);
  const named = (line: CategorySpending): CategoryLine => {
    const category = byId.get(line.categoryId);
    return {
      ...line,
      name: category?.name ?? "?",
      isActive: category?.isActive ?? true,
      icon: category?.icon ?? null,
      color: category?.color ?? null,
      children: line.children.map(named).sort(bySize),
    };
  };
  const lines = spendingByCategory(entries, categories).map(named).sort(bySize);

  const budgetCents = budgetFromCaps(categories);
  const budgetSpentCents = cappedExpenseCents(entries, categories);

  return {
    period,
    metrics,
    categories: lines,
    planned: entries.filter((e) => e.status === "planned"),
    entries,
    budgetCents,
    budgetSpentCents,
    installmentsCents: entries.filter((e) => e.kind === "expense" && e.installmentGroupId !== null).reduce((sum, e) => sum + e.amountCents, 0),
    budgetStatus: budgetStatus(budgetSpentCents, budgetCents),
    dailySpend: {
      current: dailyCumulativeExpense(entries, period),
      previous: dailyCumulativeExpense(previousAll, previousPeriod),
    },
    delta: {
      income: previous && previous.incomeCents > 0 ? (metrics.incomeCents - previous.incomeCents) / previous.incomeCents : null,
      expense: previous && previous.expenseCents > 0 ? (metrics.expenseCents - previous.expenseCents) / previous.expenseCents : null,
      throughDay,
    },
    previous,
  };
}

export interface YearMonth {
  period: Period;
  metrics: PeriodMetrics;
}

export interface YearSummary {
  from: Period;
  to: Period;
  months: YearMonth[];
  /** Totals over the range, computed from every row at once. */
  totals: PeriodMetrics;
  categories: CategoryLine[];
  /** Each month's capped spending against today's caps (caps have no history), oldest first. */
  budget: BudgetMonth[];
}

/**
 * A run of months (a calendar year or a rolling twelve, DESIGN.md §4): one
 * bounded fetch, split by month in TypeScript. Twelve months of a personal
 * ledger stay well under the §4.5 ceiling.
 */
export async function yearSummary(repos: Repositories, userId: string, from: Period, to: Period): Promise<YearSummary> {
  const [entries, categories] = await Promise.all([
    repos.entries.list(userId, { from: periodStart(from), to: periodEnd(to) }),
    repos.categories.list(userId),
  ]);
  const byPeriod = new Map<Period, Entry[]>();
  for (const e of entries) byPeriod.set(periodOf(e.date), [...(byPeriod.get(periodOf(e.date)) ?? []), e]);
  const months = periodRange(from, to).map((period) => ({
    period,
    metrics: computeMetrics({ entries: byPeriod.get(period) ?? [], categories, recurrences: [], cashCents: null }),
  }));
  const budgetCents = budgetFromCaps(categories);
  const budget: BudgetMonth[] = periodRange(from, to).map((period) => {
    const rows = byPeriod.get(period) ?? [];
    const expenseCents = rows.filter((e) => e.kind === "expense" && e.status === "settled").reduce((sum, e) => sum + e.amountCents, 0);
    const spentCents = cappedExpenseCents(rows, categories);
    return { period, expenseCents, spentCents, budgetCents, status: budgetStatus(spentCents, budgetCents) };
  });
  const byId = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const bySize = (a: CategoryLine, b: CategoryLine) => b.settledCents + b.plannedCents - (a.settledCents + a.plannedCents);
  const named = (line: CategorySpending): CategoryLine => {
    const category = byId.get(line.categoryId);
    return {
      ...line,
      name: category?.name ?? "?",
      isActive: category?.isActive ?? true,
      icon: category?.icon ?? null,
      color: category?.color ?? null,
      children: line.children.map(named).sort(bySize),
      capCents: null,
      capUsage: null,
    };
  };
  return {
    from,
    to,
    months,
    totals: computeMetrics({ entries, categories, recurrences: [], cashCents: null }),
    categories: spendingByCategory(entries, categories).map(named).sort(bySize),
    budget,
  };
}
