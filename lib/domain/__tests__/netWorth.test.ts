import { describe, expect, it } from "vitest";
import { latestCash, netWorthFor, netWorthSeries } from "../netWorth";
import { snapshot } from "./fixtures";

describe("netWorthFor", () => {
  it("is cash + investments − debt", () => {
    const point = netWorthFor(
      [
        snapshot({ accountId: "checking", kind: "cash", amountCents: 500_000 }),
        snapshot({ accountId: "wallet", kind: "cash", amountCents: 10_000 }),
        snapshot({ accountId: "card", kind: "debt", amountCents: 120_000 }),
      ],
      250_000,
    );
    expect(point).toEqual({
      period: "2026-11",
      cashCents: 510_000,
      debtCents: 120_000,
      investmentsCents: 250_000,
      netWorthCents: 640_000,
    });
  });

  // Acceptance 12: a month without a snapshot returns null net worth, not 0.
  it("returns null without a snapshot, even with investments", () => {
    expect(netWorthFor([], 250_000)).toBeNull();
  });
});

describe("netWorthSeries", () => {
  it("renders empty months as null, never zero", () => {
    const series = netWorthSeries(
      ["2026-09", "2026-10", "2026-11"],
      [
        snapshot({ period: "2026-09-01", amountCents: 100 }),
        snapshot({ period: "2026-11-01", amountCents: 300 }),
        snapshot({ period: "2026-11-01", accountId: "card", kind: "debt", amountCents: 50 }),
      ],
      (period) => (period >= "2026-10" ? 1_000 : 0),
    );

    expect(series.map((p) => p.netWorthCents)).toEqual([100, null, 1_250]);
    expect(series[1]).toEqual({
      period: "2026-10",
      cashCents: null,
      debtCents: null,
      investmentsCents: 1_000,
      netWorthCents: null,
    });
  });
});

describe("latestCash", () => {
  it("uses the most recent snapshot at or before the period", () => {
    const snapshots = [
      snapshot({ period: "2026-09-01", amountCents: 100 }),
      snapshot({ period: "2026-10-01", amountCents: 200 }),
      snapshot({ period: "2026-10-01", accountId: "wallet", amountCents: 20 }),
      snapshot({ period: "2026-10-01", accountId: "card", kind: "debt", amountCents: 999 }),
      snapshot({ period: "2026-12-01", amountCents: 400 }),
    ];
    expect(latestCash(snapshots, "2026-11")).toBe(220);
    expect(latestCash(snapshots, "2026-08")).toBeNull();
    expect(latestCash(snapshots, "2027-01")).toBe(400);
  });
});
