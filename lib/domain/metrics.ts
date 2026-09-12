// Period metrics (PROMPT.md §5.10), computed from the entries of one period.
// Transfers never enter any of these; contributions are not expenses; a
// division by zero returns `null`, which the UI renders as `—`.

import { ratio, sumCents } from "./money";
import { monthlyFixedCost } from "./recurrences";
import type { Category, Entry, IsoDate, Recurrence } from "./types";

export interface PeriodMetrics {
  incomeCents: number;
  expenseCents: number;
  contributionsCents: number;
  benefitsCents: number;
  leftoverCents: number;
  savingsRate: number | null;
  savingsRateExBenefits: number | null;
  fixedCostCents: number;
  monthsOfRunway: number | null;
  /** Planned, not yet settled, in the same period. */
  plannedIncomeCents: number;
  plannedExpenseCents: number;
}

export interface MetricsInput {
  entries: Entry[];
  categories: Pick<Category, "id" | "isBenefit">[];
  recurrences: Recurrence[];
  /** Cash on hand; `null` when unknown (no snapshot) so runway stays `null`. */
  cashCents: number | null;
}

export function computeMetrics(input: MetricsInput): PeriodMetrics {
  const benefitIds = new Set(input.categories.filter((c) => c.isBenefit).map((c) => c.id));

  let income = 0;
  let expense = 0;
  let contributions = 0;
  let benefits = 0;
  let plannedIncome = 0;
  let plannedExpense = 0;

  for (const e of input.entries) {
    if (e.status === "settled") {
      switch (e.kind) {
        case "income":
          income += e.amountCents;
          if (e.categoryId !== null && benefitIds.has(e.categoryId)) benefits += e.amountCents;
          break;
        case "expense":
          expense += e.amountCents;
          break;
        case "contribution":
          contributions += e.amountCents;
          break;
        case "transfer":
          break;
      }
    } else if (e.kind === "income") {
      plannedIncome += e.amountCents;
    } else if (e.kind === "expense") {
      plannedExpense += e.amountCents;
    }
  }

  const fixedCost = monthlyFixedCost(input.recurrences);

  return {
    incomeCents: income,
    expenseCents: expense,
    contributionsCents: contributions,
    benefitsCents: benefits,
    leftoverCents: income - expense - contributions,
    savingsRate: ratio(income - expense, income),
    savingsRateExBenefits: ratio(income - expense, income - benefits),
    fixedCostCents: fixedCost,
    monthsOfRunway: input.cashCents === null ? null : ratio(input.cashCents, fixedCost),
    plannedIncomeCents: plannedIncome,
    plannedExpenseCents: plannedExpense,
  };
}

/**
 * `committed`: what is already signed for and still to come — planned
 * installment parts due today or later. Feed it the future planned entries,
 * not one period's worth.
 */
export function committedCents(entries: Entry[], today: IsoDate): number {
  return sumCents(
    entries
      .filter(
        (e) =>
          e.status === "planned" &&
          e.kind === "expense" &&
          e.installmentGroupId !== null &&
          e.date >= today,
      )
      .map((e) => e.amountCents),
  );
}

export type EntryTiming = "settled" | "overdue" | "upcoming";

/** Derived, never stored (§5.3). */
export function entryTiming(entry: Pick<Entry, "status" | "date">, today: IsoDate): EntryTiming {
  if (entry.status === "settled") return "settled";
  return entry.date < today ? "overdue" : "upcoming";
}

export interface CategorySpending {
  categoryId: string;
  settledCents: number;
  plannedCents: number;
  capCents: number | null;
  /** settled / cap, `null` without a cap. Above 1 means overflow. */
  capUsage: number | null;
}

/** Expense per category for the cap table on /month. Sub-categories roll up into their parent. */
export function spendingByCategory(
  entries: Entry[],
  categories: Pick<Category, "id" | "parentId" | "monthlyCapCents">[],
): CategorySpending[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, { settled: number; planned: number }>();

  for (const e of entries) {
    if (e.kind !== "expense" || e.categoryId === null) continue;
    const category = byId.get(e.categoryId);
    const rootId = category?.parentId ?? e.categoryId;
    const t = totals.get(rootId) ?? { settled: 0, planned: 0 };
    if (e.status === "settled") t.settled += e.amountCents;
    else t.planned += e.amountCents;
    totals.set(rootId, t);
  }

  return [...totals].map(([categoryId, t]) => {
    const capCents = byId.get(categoryId)?.monthlyCapCents ?? null;
    return {
      categoryId,
      settledCents: t.settled,
      plannedCents: t.planned,
      capCents,
      capUsage: capCents === null ? null : t.settled / capCents,
    };
  });
}
