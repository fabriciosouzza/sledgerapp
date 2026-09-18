import { describe, expect, it } from "vitest";
import { budgetFromCaps, budgetStatus, cappedExpenseCents, computeMetrics, dailyCumulativeExpense, entryTiming, spendingByCategory } from "../metrics";
import { entry, recurrence, settled } from "./fixtures";

const categories = [
  { id: "cat-salario", isEarmarked: false },
  { id: "cat-va", isEarmarked: true },
  { id: "cat-outros", isEarmarked: false },
];

const base = { categories, recurrences: [], cashCents: null };

describe("computeMetrics", () => {
  // Acceptance 1: a contribution never appears in the expense total.
  it("keeps contributions out of expense and out of the savings rate", () => {
    const m = computeMetrics({
      ...base,
      entries: [
        settled({ kind: "income", amountCents: 500_000, categoryId: "cat-salario" }),
        settled({ kind: "expense", amountCents: 200_000 }),
        settled({ kind: "contribution", amountCents: 100_000, categoryId: null }),
      ],
    });

    expect(m.expenseCents).toBe(200_000);
    expect(m.contributionsCents).toBe(100_000);
    expect(m.leftoverCents).toBe(200_000);
    expect(m.savingsRate).toBeCloseTo(0.6);
  });

  // Acceptance 2: a transfer appears in neither income nor expense.
  // Acceptance 3: paying a card statement is not an expense; the purchase is.
  it("ignores transfers, including a card statement payment", () => {
    const m = computeMetrics({
      ...base,
      entries: [
        settled({ kind: "income", amountCents: 500_000, categoryId: "cat-salario" }),
        settled({ kind: "expense", amountCents: 80_000, accountId: "acc-card", date: "2026-10-20" }),
        settled({ kind: "transfer", amountCents: 80_000, accountId: "acc-checking", counterAccountId: "acc-card" }),
        settled({ kind: "transfer", amountCents: 999_999, accountId: "acc-checking", counterAccountId: "acc-savings" }),
      ],
    });

    expect(m.incomeCents).toBe(500_000);
    expect(m.expenseCents).toBe(80_000);
    expect(m.leftoverCents).toBe(420_000);
  });

  // Acceptance 4: investment yield enters neither income nor the savings rate.
  it("does not know about yield at all — it is not an entry", () => {
    const entries = [
      settled({ kind: "income", amountCents: 500_000, categoryId: "cat-salario" }),
      settled({ kind: "expense", amountCents: 250_000 }),
    ];
    const before = computeMetrics({ ...base, entries });
    // Yield lives in asset_movements; there is no entry kind for it, so the
    // only way it could leak in is as income, which the schema forbids for
    // movements. Asserting the shape: income is exactly the salary.
    expect(before.incomeCents).toBe(500_000);
    expect(before.savingsRate).toBe(0.5);
  });

  // Acceptance 5: savingsRateExEarmarked excludes is_earmarked categories from the denominator.
  it("computes both savings rates", () => {
    const m = computeMetrics({
      ...base,
      entries: [
        settled({ kind: "income", amountCents: 400_000, categoryId: "cat-salario" }),
        settled({ kind: "income", amountCents: 100_000, categoryId: "cat-va" }),
        settled({ kind: "expense", amountCents: 300_000 }),
      ],
    });

    expect(m.earmarkedCents).toBe(100_000);
    expect(m.savingsRate).toBeCloseTo(0.4); // 200k / 500k
    expect(m.savingsRateExEarmarked).toBeCloseTo(0.5); // 200k / 400k
  });

  it("counts only settled entries and reports planned separately", () => {
    const m = computeMetrics({
      ...base,
      entries: [
        settled({ kind: "income", amountCents: 100_000, categoryId: "cat-salario" }),
        entry({ kind: "income", amountCents: 50_000, categoryId: "cat-salario" }),
        entry({ kind: "expense", amountCents: 30_000 }),
      ],
    });
    expect(m.incomeCents).toBe(100_000);
    expect(m.expenseCents).toBe(0);
    expect(m.plannedIncomeCents).toBe(50_000);
    expect(m.plannedExpenseCents).toBe(30_000);
  });

  it("returns null rates instead of dividing by zero", () => {
    const m = computeMetrics({ ...base, entries: [settled({ kind: "expense", amountCents: 10 })] });
    expect(m.savingsRate).toBeNull();
    expect(m.savingsRateExEarmarked).toBeNull();
    expect(m.monthsOfRunway).toBeNull();
  });

  it("derives fixed cost and runway from recurrences and cash", () => {
    const m = computeMetrics({
      ...base,
      entries: [],
      recurrences: [recurrence({ amountCents: 200_000 }), recurrence({ amountCents: 50_000 })],
      cashCents: 1_000_000,
    });
    expect(m.fixedCostCents).toBe(250_000);
    expect(m.monthsOfRunway).toBe(4);

    const noCash = computeMetrics({ ...base, entries: [], recurrences: [recurrence()], cashCents: null });
    expect(noCash.monthsOfRunway).toBeNull();
  });
});

describe("entryTiming", () => {
  it("derives overdue and upcoming from status and date", () => {
    expect(entryTiming(entry({ date: "2026-11-04" }), "2026-11-05")).toBe("overdue");
    expect(entryTiming(entry({ date: "2026-11-05" }), "2026-11-05")).toBe("upcoming");
    expect(entryTiming(settled({ date: "2026-11-01" }), "2026-11-05")).toBe("settled");
  });
});

describe("spendingByCategory", () => {
  it("totals per root category with cap usage", () => {
    const cats = [
      { id: "food", parentId: null, monthlyCapCents: 100_000 },
      { id: "food-out", parentId: "food", monthlyCapCents: null },
      { id: "misc", parentId: null, monthlyCapCents: null },
    ];
    const rows = spendingByCategory(
      [
        settled({ categoryId: "food", amountCents: 60_000 }),
        settled({ categoryId: "food-out", amountCents: 50_000 }),
        entry({ categoryId: "food", amountCents: 10_000 }),
        settled({ categoryId: "misc", amountCents: 5_000 }),
        settled({ kind: "income", categoryId: "misc", amountCents: 999 }),
      ],
      cats,
    );

    expect(rows).toEqual([
      {
        categoryId: "food",
        settledCents: 110_000,
        plannedCents: 10_000,
        capCents: 100_000,
        capUsage: 1.1,
        children: [{ categoryId: "food-out", settledCents: 50_000, plannedCents: 0, capCents: null, capUsage: null, children: [] }],
      },
      { categoryId: "misc", settledCents: 5_000, plannedCents: 0, capCents: null, capUsage: null, children: [] },
    ]);
  });
});

describe("dailyCumulativeExpense", () => {
  it("accumulates settled expenses by day of the period only", () => {
    const series = dailyCumulativeExpense(
      [
        settled({ date: "2026-02-01", amountCents: 100 }),
        settled({ date: "2026-02-03", amountCents: 50 }),
        entry({ date: "2026-02-05", amountCents: 999 }), // planned: not spent yet
        settled({ date: "2026-01-31", amountCents: 999 }), // other month
        settled({ kind: "income", categoryId: "cat-salario", date: "2026-02-02", amountCents: 999 }),
      ],
      "2026-02",
    );
    expect(series).toHaveLength(28);
    expect(series.slice(0, 5)).toEqual([100, 100, 150, 150, 150]);
    expect(series[27]).toBe(150);
  });
});

describe("budget from caps", () => {
  const cats = [
    { id: "food", parentId: null, monthlyCapCents: 100_000, isActive: true },
    { id: "food-out", parentId: "food", monthlyCapCents: 40_000, isActive: true }, // under a capped root: not added twice
    { id: "home", parentId: null, monthlyCapCents: null, isActive: true },
    { id: "rent", parentId: "home", monthlyCapCents: 250_000, isActive: true },
    { id: "old", parentId: null, monthlyCapCents: 999, isActive: false },
  ];

  it("sums root caps, or children caps when the root has none", () => {
    expect(budgetFromCaps(cats)).toBe(350_000);
    expect(budgetFromCaps([{ id: "x", parentId: null, monthlyCapCents: null, isActive: true }])).toBeNull();
  });

  it("counts only settled expense that a cap covers", () => {
    const row = (categoryId: string | null, amountCents: number, status: "settled" | "planned" = "settled") => ({ kind: "expense" as const, status, categoryId, amountCents });
    const rows = [
      row("food", 100), // capped root
      row("food-out", 20), // child of a capped root
      row("rent", 300), // capped child of a root without a cap
      row("home", 50), // the uncapped root itself
      row("old", 7), // inactive category
      row(null, 9), // no category
      row("food", 1_000, "planned"), // not spent yet
      { kind: "income" as const, status: "settled" as const, categoryId: "food", amountCents: 5 },
    ];
    expect(cappedExpenseCents(rows, cats)).toBe(420);
  });

  it("classifies usage", () => {
    expect(budgetStatus(50, 100)).toBe("within");
    expect(budgetStatus(80, 100)).toBe("risk");
    expect(budgetStatus(101, 100)).toBe("over");
    expect(budgetStatus(10, null)).toBeNull();
  });
});
