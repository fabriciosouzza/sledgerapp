// Month summary (PROMPT.md §5.10, §7 /month): metrics computed in TypeScript
// from one period's rows. Cash is the latest snapshot at or before the period;
// without one, runway is unknown, not zero.

import { addMonths, periodEnd, periodOf, periodRange, periodStart } from "@/lib/domain/dates";
import {
  budgetFromCaps,
  budgetStatus,
  computeMetrics,
  dailyCumulativeExpense,
  spendingByCategory,
  type BudgetStatus,
  type CategorySpending,
  type PeriodMetrics,
} from "@/lib/domain/metrics";
import { latestCash } from "@/lib/domain/netWorth";
import type { Category, Entry, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";

export interface CategoryLine extends Omit<CategorySpending, "children"> {
  name: string;
  isActive: boolean;
  icon: string | null;
  color: string | null;
  children: CategoryLine[];
}

export interface BudgetMonth {
  period: Period;
  expenseCents: number;
  budgetCents: number | null;
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
  budgetStatus: BudgetStatus | null;
  /** Settled expense accumulated per day, this month and the previous one. */
  dailySpend: { current: number[]; previous: number[] };
  /** The last six months, oldest first, against today's caps. */
  history: BudgetMonth[];
  /** Change vs the previous month, `null` when that month has nothing to compare. */
  delta: { income: number | null; expense: number | null };
}

const HISTORY_MONTHS = 6;

export async function monthSummary(repos: Repositories, userId: string, period: Period): Promise<MonthSummary> {
  const historyFrom = addMonths(period, -(HISTORY_MONTHS - 1));
  const previousPeriod = addMonths(period, -1);
  const [entries, categories, recurrences, snapshots, past, previousAll] = await Promise.all([
    repos.entries.list(userId, { period }),
    repos.categories.list(userId),
    repos.recurrences.list(userId),
    repos.snapshots.listBetween(userId, addMonths(period, -12), period),
    // One bounded range for the history and last month's daily line (§4.5).
    repos.entries.list(userId, { from: periodStart(historyFrom), to: periodEnd(previousPeriod), kind: "expense", status: "settled" }),
    repos.entries.list(userId, { period: previousPeriod }),
  ]);
  const previous = computeMetrics({ entries: previousAll, categories, recurrences: [], cashCents: null });

  const metrics = computeMetrics({ entries, categories, recurrences, cashCents: latestCash(snapshots, period) });
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
  const byPeriod = new Map<Period, Entry[]>();
  for (const e of past) byPeriod.set(periodOf(e.date), [...(byPeriod.get(periodOf(e.date)) ?? []), e]);
  const history: BudgetMonth[] = periodRange(historyFrom, period).map((p) => {
    const rows = p === period ? entries : (byPeriod.get(p) ?? []);
    const expenseCents = rows.filter((e) => e.kind === "expense" && e.status === "settled").reduce((sum, e) => sum + e.amountCents, 0);
    return { period: p, expenseCents, budgetCents, status: budgetStatus(expenseCents, budgetCents) };
  });

  return {
    period,
    metrics,
    categories: lines,
    planned: entries.filter((e) => e.status === "planned"),
    entries,
    budgetCents,
    budgetStatus: budgetStatus(metrics.expenseCents, budgetCents),
    dailySpend: {
      current: dailyCumulativeExpense(entries, period),
      previous: dailyCumulativeExpense(byPeriod.get(addMonths(period, -1)) ?? [], addMonths(period, -1)),
    },
    history,
    delta: {
      income: previous.incomeCents > 0 ? (metrics.incomeCents - previous.incomeCents) / previous.incomeCents : null,
      expense: previous.expenseCents > 0 ? (metrics.expenseCents - previous.expenseCents) / previous.expenseCents : null,
    },
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
  };
}
