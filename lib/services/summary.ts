// Month summary (PROMPT.md §5.10, §7 /month): metrics computed in TypeScript
// from one period's rows. Cash is the latest snapshot at or before the period;
// without one, runway is unknown, not zero.

import { addMonths } from "@/lib/domain/dates";
import { computeMetrics, spendingByCategory, type CategorySpending, type PeriodMetrics } from "@/lib/domain/metrics";
import { latestCash } from "@/lib/domain/netWorth";
import type { Category, Entry, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";

export interface CategoryLine extends Omit<CategorySpending, "children"> {
  name: string;
  isActive: boolean;
  children: CategoryLine[];
}

export interface MonthSummary {
  period: Period;
  metrics: PeriodMetrics;
  categories: CategoryLine[];
  planned: Entry[];
  entries: Entry[];
}

export async function monthSummary(repos: Repositories, userId: string, period: Period): Promise<MonthSummary> {
  const [entries, categories, recurrences, snapshots] = await Promise.all([
    repos.entries.list(userId, { period }),
    repos.categories.list(userId),
    repos.recurrences.list(userId),
    repos.snapshots.listBetween(userId, addMonths(period, -12), period),
  ]);

  const metrics = computeMetrics({ entries, categories, recurrences, cashCents: latestCash(snapshots, period) });
  const byId = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const bySize = (a: CategoryLine, b: CategoryLine) => b.settledCents + b.plannedCents - (a.settledCents + a.plannedCents);
  const named = (line: CategorySpending): CategoryLine => {
    const category = byId.get(line.categoryId);
    return {
      ...line,
      name: category?.name ?? "?",
      isActive: category?.isActive ?? true,
      children: line.children.map(named).sort(bySize),
    };
  };
  const lines = spendingByCategory(entries, categories).map(named).sort(bySize);

  return {
    period,
    metrics,
    categories: lines,
    planned: entries.filter((e) => e.status === "planned"),
    entries,
  };
}
