import { describe, expect, it } from "vitest";
import { expandInstallments, installmentsInScope, lastInstallmentPeriod } from "../installments";

const purchase = {
  description: "Notebook",
  kind: "expense" as const,
  amountCents: 14990,
  parts: 12,
  firstDate: "2026-10-15",
  categoryId: "cat",
  accountId: "card-a",
};

describe("expandInstallments", () => {
  // Acceptance 9: a 12× purchase creates 12 numbered entries, one per month, one group id.
  it("creates N numbered planned entries sharing one group id", () => {
    const rows = expandInstallments(purchase, "group-1");

    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.installmentNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(rows.map((r) => r.installmentGroupId))).toEqual(new Set(["group-1"]));
    expect(new Set(rows.map((r) => r.installmentTotal))).toEqual(new Set([12]));
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(["planned"]));
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(["installment"]));
    expect(rows.map((r) => r.date.slice(0, 7))).toEqual([
      "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03",
      "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09",
    ]);
    expect(rows.every((r) => r.amountCents === 14990)).toBe(true);
  });

  it("clamps the day in short months", () => {
    const rows = expandInstallments({ ...purchase, firstDate: "2026-01-31", parts: 4 }, "g");
    expect(rows.map((r) => r.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("can be born with the first part settled", () => {
    const rows = expandInstallments({ ...purchase, parts: 3, firstSettledOn: "2026-10-15" }, "g");
    expect(rows[0].status).toBe("settled");
    expect(rows[0].settledOn).toBe("2026-10-15");
    expect(rows[1].status).toBe("planned");
    expect(rows[1].settledOn).toBeNull();
  });

  it("rejects nonsense", () => {
    expect(() => expandInstallments({ ...purchase, parts: 0 }, "g")).toThrow(RangeError);
    expect(() => expandInstallments({ ...purchase, amountCents: 0 }, "g")).toThrow(RangeError);
  });

  it("previews the last period", () => {
    expect(lastInstallmentPeriod("2026-10-15", 12)).toBe("2027-09");
    expect(lastInstallmentPeriod("2026-10-15", 1)).toBe("2026-10");
  });
});

describe("installmentsInScope", () => {
  const group = [1, 2, 3, 4].map((installmentNo) => ({ installmentNo }));

  it("selects this, this and future, or all", () => {
    expect(installmentsInScope(group, 3, "this").map((e) => e.installmentNo)).toEqual([3]);
    expect(installmentsInScope(group, 3, "this_and_future").map((e) => e.installmentNo)).toEqual([3, 4]);
    expect(installmentsInScope(group, 3, "all").map((e) => e.installmentNo)).toEqual([1, 2, 3, 4]);
  });
});
