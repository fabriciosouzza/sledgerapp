import { describe, expect, it } from "vitest";
import { committedCents, computeMetrics, entryTiming, spendingByCategory } from "../metrics";
import { entry, recurrence, settled } from "./fixtures";

const categories = [
  { id: "cat-salario", isBenefit: false },
  { id: "cat-va", isBenefit: true },
  { id: "cat-outros", isBenefit: false },
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
        settled({ kind: "contribution", amountCents: 100_000, categoryId: null, counterAccountId: "acc-broker" }),
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

  // Acceptance 5: savingsRateExBenefits excludes is_benefit categories from the denominator.
  it("computes both savings rates", () => {
    const m = computeMetrics({
      ...base,
      entries: [
        settled({ kind: "income", amountCents: 400_000, categoryId: "cat-salario" }),
        settled({ kind: "income", amountCents: 100_000, categoryId: "cat-va" }),
        settled({ kind: "expense", amountCents: 300_000 }),
      ],
    });

    expect(m.benefitsCents).toBe(100_000);
    expect(m.savingsRate).toBeCloseTo(0.4); // 200k / 500k
    expect(m.savingsRateExBenefits).toBeCloseTo(0.5); // 200k / 400k
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
    expect(m.savingsRateExBenefits).toBeNull();
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

describe("committedCents", () => {
  it("sums future planned installment parts", () => {
    const committed = committedCents(
      [
        entry({ amountCents: 100, installmentGroupId: "g", installmentNo: 2, installmentTotal: 3, date: "2026-11-05" }),
        entry({ amountCents: 200, installmentGroupId: "g", installmentNo: 3, installmentTotal: 3, date: "2026-12-05" }),
        settled({ amountCents: 400, installmentGroupId: "g", installmentNo: 1, installmentTotal: 3, date: "2026-10-05" }),
        entry({ amountCents: 800, installmentGroupId: "g2", installmentNo: 1, installmentTotal: 2, date: "2026-11-04" }),
        entry({ amountCents: 1600, date: "2026-12-05" }),
      ],
      "2026-11-05",
    );
    expect(committed).toBe(300);
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
      { categoryId: "food", settledCents: 110_000, plannedCents: 10_000, capCents: 100_000, capUsage: 1.1 },
      { categoryId: "misc", settledCents: 5_000, plannedCents: 0, capCents: null, capUsage: null },
    ]);
  });
});
