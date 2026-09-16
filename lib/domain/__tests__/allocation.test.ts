import { describe, expect, it } from "vitest";
import { allocationProblem, linesFromMovements, sharesFromLines, sharesProblem, splitByShares, unallocated } from "../allocation";
import { settled } from "./fixtures";

describe("splitByShares", () => {
  // Acceptance 18: the parts always add up to the amount, whatever the percentages.
  it("splits by largest remainder so the parts sum exactly", () => {
    const lines = splitByShares(100_001, [
      { assetId: "a", sharePercent: 70 },
      { assetId: "b", sharePercent: 30 },
    ]);
    expect(lines).toEqual([
      { assetId: "a", amountCents: 70_001 },
      { assetId: "b", amountCents: 30_000 },
    ]);
    const thirds = splitByShares(100, [
      { assetId: "a", sharePercent: 33 },
      { assetId: "b", sharePercent: 33 },
      { assetId: "c", sharePercent: 34 },
    ]);
    expect(thirds.reduce((sum, l) => sum + l.amountCents, 0)).toBe(100);
    expect(thirds).toEqual([
      { assetId: "a", amountCents: 33 },
      { assetId: "b", amountCents: 33 },
      { assetId: "c", amountCents: 34 },
    ]);
  });

  it("drops a share that rounds to nothing and gives nothing for nothing", () => {
    expect(splitByShares(1, [{ assetId: "a", sharePercent: 99 }, { assetId: "b", sharePercent: 1 }])).toEqual([{ assetId: "a", amountCents: 1 }]);
    expect(splitByShares(0, [{ assetId: "a", sharePercent: 100 }])).toEqual([]);
    expect(splitByShares(100, [])).toEqual([]);
  });
});

describe("sharesFromLines", () => {
  it("turns how a contribution was split into whole percentages summing to 100", () => {
    const shares = sharesFromLines([
      { assetId: "a", amountCents: 700 },
      { assetId: "b", amountCents: 300 },
    ]);
    expect(shares).toEqual([
      { assetId: "a", sharePercent: 70 },
      { assetId: "b", sharePercent: 30 },
    ]);
    const uneven = sharesFromLines([
      { assetId: "a", amountCents: 1 },
      { assetId: "b", amountCents: 1 },
      { assetId: "c", amountCents: 1 },
    ]);
    expect(uneven.reduce((sum, s) => sum + s.sharePercent, 0)).toBe(100);
    expect(sharesProblem(uneven)).toBeNull();
  });
});

describe("allocationProblem", () => {
  it("accepts parts that add up and names what is wrong otherwise", () => {
    expect(allocationProblem([{ assetId: "a", amountCents: 600 }, { assetId: "b", amountCents: 400 }], 1000)).toBeNull();
    expect(allocationProblem([], 1000)).toMatch(/at least one/);
    expect(allocationProblem([{ assetId: "a", amountCents: 999 }], 1000)).toMatch(/do not add up/);
    expect(allocationProblem([{ assetId: "a", amountCents: 1001 }], 1000)).toMatch(/exceed/);
    expect(allocationProblem([{ assetId: "a", amountCents: 500 }, { assetId: "a", amountCents: 500 }], 1000)).toMatch(/twice/);
    expect(allocationProblem([{ assetId: "a", amountCents: 0 }, { assetId: "b", amountCents: 1000 }], 1000)).toMatch(/more than zero/);
  });
});

describe("sharesProblem", () => {
  it("allows no split at all, or one that sums to exactly 100", () => {
    expect(sharesProblem([])).toBeNull();
    expect(sharesProblem([{ assetId: "a", sharePercent: 100 }])).toBeNull();
    expect(sharesProblem([{ assetId: "a", sharePercent: 60 }, { assetId: "b", sharePercent: 30 }])).toMatch(/90%/);
    expect(sharesProblem([{ assetId: "a", sharePercent: 0 }, { assetId: "b", sharePercent: 100 }])).toMatch(/1 to 100/);
  });
});

describe("unallocated", () => {
  it("finds settled contributions whose paired movements do not add up", () => {
    const whole = { ...settled({ kind: "contribution", amountCents: 1000 }), id: "e1" };
    const partial = { ...settled({ kind: "contribution", amountCents: 1000 }), id: "e2" };
    const none = { ...settled({ kind: "redemption", amountCents: 500 }), id: "e3" };
    const planned = { ...settled({ kind: "contribution", amountCents: 700 }), id: "e4", status: "planned" as const, settledOn: null };
    const expense = { ...settled({ kind: "expense", amountCents: 700 }), id: "e5" };
    const movements = [
      { entryId: "e1", amountCents: 600, kind: "contribution" as const },
      { entryId: "e1", amountCents: 400, kind: "contribution" as const },
      { entryId: "e2", amountCents: 400, kind: "contribution" as const },
      { entryId: null, amountCents: 999, kind: "yield" as const },
    ];
    expect(unallocated([whole, partial, none, planned, expense], movements)).toEqual([
      { entry: partial, allocatedCents: 400 },
      { entry: none, allocatedCents: 0 },
    ]);
  });

  it("reads an allocation back from movements, merging lines of one asset", () => {
    expect(linesFromMovements([{ assetId: "a", amountCents: 1 }, { assetId: "b", amountCents: 2 }, { assetId: "a", amountCents: 3 }])).toEqual([
      { assetId: "a", amountCents: 4 },
      { assetId: "b", amountCents: 2 },
    ]);
  });
});
