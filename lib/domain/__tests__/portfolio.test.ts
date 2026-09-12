import { describe, expect, it } from "vitest";
import { assetBalance, balanceByClass, investmentsAt, movementSign, portfolioSeries, summarize } from "../portfolio";
import { movement } from "./fixtures";

describe("assetBalance", () => {
  // Acceptance 11: asset balance honours the signs of all five movement kinds.
  it("adds contribution, yield and adjustment; subtracts withdrawal and fees", () => {
    const balance = assetBalance([
      movement({ kind: "contribution", amountCents: 100_000 }),
      movement({ kind: "yield", amountCents: 1_200 }),
      movement({ kind: "market_adjustment", amountCents: -3_000 }),
      movement({ kind: "withdrawal", amountCents: 20_000 }),
      movement({ kind: "fee_tax", amountCents: 150 }),
    ]);
    expect(balance).toBe(100_000 + 1_200 - 3_000 - 20_000 - 150);
  });

  it("has a sign per kind", () => {
    expect(movementSign("contribution")).toBe(1);
    expect(movementSign("yield")).toBe(1);
    expect(movementSign("market_adjustment")).toBe(1);
    expect(movementSign("withdrawal")).toBe(-1);
    expect(movementSign("fee_tax")).toBe(-1);
  });
});

describe("summarize", () => {
  it("separates contributed from earned", () => {
    const s = summarize([
      movement({ kind: "contribution", amountCents: 100_000 }),
      movement({ kind: "withdrawal", amountCents: 20_000 }),
      movement({ kind: "yield", amountCents: 5_000 }),
      movement({ kind: "market_adjustment", amountCents: 1_000 }),
      movement({ kind: "fee_tax", amountCents: 500 }),
    ]);
    expect(s).toEqual({ contributedCents: 80_000, earnedCents: 5_500, balanceCents: 85_500, returnRate: 5_500 / 80_000 });
  });

  it("returns a null rate without contributions", () => {
    expect(summarize([]).returnRate).toBeNull();
  });
});

describe("balanceByClass", () => {
  it("groups by asset class through the asset", () => {
    const out = balanceByClass(
      [
        { id: "cdb", assetClass: "fixed_income" },
        { id: "tesouro", assetClass: "fixed_income" },
        { id: "btc", assetClass: "crypto" },
      ],
      [
        movement({ assetId: "cdb", amountCents: 100 }),
        movement({ assetId: "tesouro", amountCents: 200 }),
        movement({ assetId: "btc", amountCents: 50 }),
        movement({ assetId: "btc", kind: "market_adjustment", amountCents: -10 }),
        movement({ assetId: "ghost", amountCents: 999 }),
      ],
    );
    expect(out.get("fixed_income")).toBe(300);
    expect(out.get("crypto")).toBe(40);
    expect(out.size).toBe(2);
  });
});

describe("series", () => {
  const movements = [
    movement({ date: "2026-09-10", kind: "contribution", amountCents: 1_000 }),
    movement({ date: "2026-10-01", kind: "yield", amountCents: 10 }),
    movement({ date: "2026-12-05", kind: "contribution", amountCents: 500 }),
  ];

  it("accumulates contributed vs earned per period", () => {
    expect(portfolioSeries(movements, "2026-08", "2026-12")).toEqual([
      { period: "2026-08", contributedCents: 0, earnedCents: 0 },
      { period: "2026-09", contributedCents: 1_000, earnedCents: 0 },
      { period: "2026-10", contributedCents: 1_000, earnedCents: 10 },
      { period: "2026-11", contributedCents: 1_000, earnedCents: 10 },
      { period: "2026-12", contributedCents: 1_500, earnedCents: 10 },
    ]);
  });

  it("values investments at a period", () => {
    expect(investmentsAt(movements, "2026-11")).toBe(1_010);
    expect(investmentsAt(movements, "2026-08")).toBe(0);
  });
});
