import { describe, expect, it } from "vitest";
import { monthInsight } from "../insights";
import type { PeriodMetrics } from "../metrics";

const metrics = (overrides: Partial<PeriodMetrics> = {}): PeriodMetrics => ({
  incomeCents: 0,
  expenseCents: 0,
  contributionsCents: 0,
  benefitsCents: 0,
  leftoverCents: 0,
  savingsRate: null,
  savingsRateExBenefits: null,
  fixedCostCents: 0,
  monthsOfRunway: null,
  plannedIncomeCents: 0,
  plannedExpenseCents: 0,
  ...overrides,
});

describe("monthInsight", () => {
  it("compares spending with last month when both months have expenses", () => {
    const insight = monthInsight(metrics({ expenseCents: 88_000, incomeCents: 500_000, savingsRate: 0.824 }), metrics({ expenseCents: 100_000 }));
    expect(insight).toMatchObject({ headline: "Spending down 12% vs last month", tone: "good", ring: 0.824 });
    expect(insight?.detail).toBe("Savings rate 82%");
  });

  it("flags spending up", () => {
    const insight = monthInsight(metrics({ expenseCents: 130_000 }), metrics({ expenseCents: 100_000 }));
    expect(insight).toMatchObject({ headline: "Spending up 30% vs last month", tone: "bad", ring: null });
  });

  it("falls back to the savings rate without a comparable last month", () => {
    const insight = monthInsight(metrics({ incomeCents: 500_000, expenseCents: 300_000, savingsRate: 0.4, benefitsCents: 50_000, savingsRateExBenefits: 0.44 }), null);
    expect(insight).toMatchObject({ headline: "You kept 40% of what came in", detail: "44% without benefits", tone: "good" });
  });

  it("says when spending exceeds income", () => {
    const insight = monthInsight(metrics({ incomeCents: 100, expenseCents: 150, savingsRate: -0.5 }), metrics({ expenseCents: 0 }));
    expect(insight).toMatchObject({ headline: "Spending exceeds income by 50%", tone: "bad" });
  });

  it("mentions what is still planned when nothing was settled", () => {
    expect(monthInsight(metrics({ plannedExpenseCents: 25_000 }), null)?.headline).toMatch(/^R\$.250,00 still to settle this month$/);
  });

  it("says nothing with no data", () => {
    expect(monthInsight(metrics(), null)).toBeNull();
    // A change under 1% is noise, not news; the savings rate speaks instead.
    expect(monthInsight(metrics({ expenseCents: 100_050, incomeCents: 200_000, savingsRate: 0.5 }), metrics({ expenseCents: 100_000 }))?.headline).toBe("You kept 50% of what came in");
  });
});

describe("monthInsight, month in progress", () => {
  it("names the same point last month once the month is old enough, and stays quiet before that", () => {
    const current = metrics({ expenseCents: 50_000, incomeCents: 500_000, savingsRate: 0.9 });
    const previous = metrics({ expenseCents: 100_000 });
    expect(monthInsight(current, previous, { throughDay: 12 })?.headline).toBe("Spending down 50% vs the same point last month");
    expect(monthInsight(current, previous, { throughDay: 3 })?.headline).toBe("You kept 90% of what came in");
  });
});
