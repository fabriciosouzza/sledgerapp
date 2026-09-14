// Period metrics (PROMPT.md §5.10), computed from the entries of one period.
// Transfers never enter any of these; contributions are not expenses; a
// division by zero returns `null`, which the UI renders as `—`.

import { dayOf, daysInMonth, parsePeriod, periodOf } from "./dates";
import { ratio, sumCents } from "./money";
import { monthlyFixedCost } from "./recurrences";
import type { Category, Entry, IsoDate, Period, Recurrence } from "./types";

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
  /** Cash on hand; `null` when unknown (no cash account yet) so runway stays `null`. */
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
  /** Sub-categories with their own spending and caps; a root's totals include them. */
  children: CategorySpending[];
}

/** Expense per category for the cap table on /month: roots roll up their children, each child keeps its own cap. */
export function spendingByCategory(
  entries: Entry[],
  categories: Pick<Category, "id" | "parentId" | "monthlyCapCents">[],
): CategorySpending[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const own = new Map<string, { settled: number; planned: number }>();

  for (const e of entries) {
    if (e.kind !== "expense" || e.categoryId === null) continue;
    const t = own.get(e.categoryId) ?? { settled: 0, planned: 0 };
    if (e.status === "settled") t.settled += e.amountCents;
    else t.planned += e.amountCents;
    own.set(e.categoryId, t);
  }

  const line = (categoryId: string, settled: number, planned: number, children: CategorySpending[]): CategorySpending => {
    const capCents = byId.get(categoryId)?.monthlyCapCents ?? null;
    return { categoryId, settledCents: settled, plannedCents: planned, capCents, capUsage: capCents === null ? null : settled / capCents, children };
  };

  const roots = new Map<string, CategorySpending[]>();
  const rootOrder: string[] = [];
  for (const [categoryId, t] of own) {
    const parentId = byId.get(categoryId)?.parentId ?? null;
    const rootId = parentId ?? categoryId;
    if (!roots.has(rootId)) {
      roots.set(rootId, []);
      rootOrder.push(rootId);
    }
    if (parentId !== null) roots.get(rootId)!.push(line(categoryId, t.settled, t.planned, []));
  }

  return rootOrder.map((rootId) => {
    const children = roots.get(rootId) ?? [];
    const self = own.get(rootId) ?? { settled: 0, planned: 0 };
    const settled = self.settled + children.reduce((sum, c) => sum + c.settledCents, 0);
    const planned = self.planned + children.reduce((sum, c) => sum + c.plannedCents, 0);
    return line(rootId, settled, planned, children);
  });
}

/** Settled expense accumulated day by day through the period (index 0 = day 1). */
export function dailyCumulativeExpense(entries: Entry[], period: Period): number[] {
  const { year, month } = parsePeriod(period);
  const days = daysInMonth(year, month);
  const perDay = new Array<number>(days).fill(0);
  for (const e of entries) {
    if (e.kind !== "expense" || e.status !== "settled" || periodOf(e.date) !== period) continue;
    perDay[dayOf(e.date) - 1] += e.amountCents;
  }
  let running = 0;
  return perDay.map((v) => (running += v));
}

/**
 * The month's budget is the sum of category caps (DESIGN.md §5): a root's cap
 * when it has one, otherwise its children's caps. `null` with no caps at all.
 */
export function budgetFromCaps(categories: Pick<Category, "id" | "parentId" | "monthlyCapCents" | "isActive">[]): number | null {
  const active = categories.filter((c) => c.isActive);
  let total = 0;
  let any = false;
  for (const root of active.filter((c) => c.parentId === null)) {
    if (root.monthlyCapCents !== null) {
      total += root.monthlyCapCents;
      any = true;
      continue;
    }
    for (const child of active.filter((c) => c.parentId === root.id)) {
      if (child.monthlyCapCents !== null) {
        total += child.monthlyCapCents;
        any = true;
      }
    }
  }
  return any ? total : null;
}

/**
 * Settled expense the budget covers — the scope `budgetFromCaps` sums: a capped
 * root with all its children, or a capped child of a root without a cap.
 * Spending anywhere else has no cap to be measured against.
 */
export function cappedExpenseCents(
  entries: Pick<Entry, "kind" | "status" | "categoryId" | "amountCents">[],
  categories: Pick<Category, "id" | "parentId" | "monthlyCapCents" | "isActive">[],
): number {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const covered = (categoryId: string | null): boolean => {
    const category = categoryId === null ? undefined : byId.get(categoryId);
    if (!category) return false;
    const root = category.parentId === null ? category : byId.get(category.parentId);
    if (!root?.isActive) return false;
    if (root.monthlyCapCents !== null) return true;
    return category !== root && category.isActive && category.monthlyCapCents !== null;
  };
  return entries.filter((e) => e.kind === "expense" && e.status === "settled" && covered(e.categoryId)).reduce((sum, e) => sum + e.amountCents, 0);
}

export type BudgetStatus = "within" | "risk" | "over";

/** Under 80% within, up to 100% at risk, beyond that over; `null` without a budget. */
export function budgetStatus(spentCents: number, budgetCents: number | null): BudgetStatus | null {
  if (budgetCents === null || budgetCents <= 0) return null;
  const usage = spentCents / budgetCents;
  return usage > 1 ? "over" : usage >= 0.8 ? "risk" : "within";
}
