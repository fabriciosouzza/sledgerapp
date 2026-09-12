import { describe, expect, it } from "vitest";
import { netWorthFor, netWorthSeries } from "../netWorth";
import { debtAt } from "../statements";

describe("netWorthFor", () => {
  it("is cash + investments − debt", () => {
    expect(netWorthFor("2026-11", 510_000, 250_000, 120_000)).toEqual({
      period: "2026-11",
      cashCents: 510_000,
      debtCents: 120_000,
      investmentsCents: 250_000,
      netWorthCents: 640_000,
    });
  });

  // Acceptance 12: unknown cash means unknown net worth, not 0 — even with investments.
  it("is null while cash is unknown", () => {
    expect(netWorthFor("2026-11", null, 250_000, 0).netWorthCents).toBeNull();
  });
});

describe("netWorthSeries", () => {
  it("renders months before the first account as null, never zero", () => {
    const series = netWorthSeries(["2026-09", "2026-10", "2026-11"], {
      cashAt: (p) => (p >= "2026-10" ? 100 : null),
      investmentsAt: () => 1_000,
      debtAt: (p) => (p === "2026-11" ? 50 : 0),
    });
    expect(series.map((p) => p.netWorthCents)).toEqual([null, 1_100, 1_050]);
  });
});

describe("debtAt", () => {
  const buy = (date: string, amountCents: number) => ({ date, kind: "expense" as const, amountCents });
  const statements = [
    { paidOn: "2026-09-28", entries: [buy("2026-09-10", 100)] },
    { paidOn: null, entries: [buy("2026-10-01", 150), buy("2026-10-15", 50)] },
    { paidOn: null, entries: [buy("2026-11-02", 400), buy("2026-11-25", 300)] },
  ];
  it("counts what was bought by that date on statements unpaid at that date, open cycles included", () => {
    expect(debtAt(statements, "2026-09-25")).toBe(100);
    expect(debtAt(statements, "2026-09-30")).toBe(0);
    expect(debtAt(statements, "2026-10-10")).toBe(150);
    expect(debtAt(statements, "2026-10-31")).toBe(200);
    expect(debtAt(statements, "2026-11-10")).toBe(600);
    expect(debtAt(statements, "2026-11-30")).toBe(900);
  });
});
