import { describe, expect, it } from "vitest";
import { expandRecurrences, monthlyFixedCost, recurrenceAppliesTo } from "../recurrences";
import { recurrence } from "./fixtures";

describe("recurrenceAppliesTo", () => {
  // Acceptance 7: ends_on before the month, or starts_on after it, generate nothing.
  it("generates nothing when ends_on precedes the month", () => {
    expect(recurrenceAppliesTo(recurrence({ endsOn: "2026-10-31" }), "2026-11")).toBe(false);
  });

  it("generates nothing when starts_on follows the month", () => {
    expect(recurrenceAppliesTo(recurrence({ startsOn: "2026-12-01" }), "2026-11")).toBe(false);
  });

  it("generates in the months between, inclusive of edges", () => {
    const r = recurrence({ startsOn: "2026-11-10", endsOn: "2027-01-10", dueDay: 10 });
    expect(recurrenceAppliesTo(r, "2026-10")).toBe(false);
    expect(recurrenceAppliesTo(r, "2026-11")).toBe(true);
    expect(recurrenceAppliesTo(r, "2026-12")).toBe(true);
    expect(recurrenceAppliesTo(r, "2027-01")).toBe(true);
    expect(recurrenceAppliesTo(r, "2027-02")).toBe(false);
  });

  it("first occurs on the first due date after starts_on", () => {
    const r = recurrence({ startsOn: "2026-11-20", dueDay: 5 });
    expect(recurrenceAppliesTo(r, "2026-11")).toBe(false);
    expect(recurrenceAppliesTo(r, "2026-12")).toBe(true);
  });

  it("skips inactive templates", () => {
    expect(recurrenceAppliesTo(recurrence({ isActive: false }), "2026-11")).toBe(false);
  });
});

describe("expandRecurrences", () => {
  it("produces planned entries tagged with recurrence and period", () => {
    const rent = recurrence({ id: "rent", dueDay: 31, amountCents: 150_000 });
    const gone = recurrence({ id: "gone", endsOn: "2025-12-31" });
    const [row, ...rest] = expandRecurrences([rent, gone], "2026-02");

    expect(rest).toHaveLength(0);
    expect(row.date).toBe("2026-02-28");
    expect(row.period).toBe("2026-02-01");
    expect(row.recurrenceId).toBe("rent");
    expect(row.status).toBe("planned");
    expect(row.settledOn).toBeNull();
    expect(row.source).toBe("recurrence");
    expect(row.amountCents).toBe(150_000);
  });

  it("carries the counter account of transfers and contributions", () => {
    const [row] = expandRecurrences(
      [recurrence({ kind: "contribution", categoryId: null, counterAccountId: "acc-broker" })],
      "2026-11",
    );
    expect(row.kind).toBe("contribution");
    expect(row.counterAccountId).toBe("acc-broker");
  });
});

describe("monthlyFixedCost", () => {
  it("sums active expense recurrences only", () => {
    const cost = monthlyFixedCost([
      recurrence({ amountCents: 150_000 }),
      recurrence({ amountCents: 20_000 }),
      recurrence({ amountCents: 99_999, isActive: false }),
      recurrence({ amountCents: 500_000, kind: "income", categoryId: "cat-salario" }),
      recurrence({ amountCents: 100_000, kind: "contribution", categoryId: null, counterAccountId: "b" }),
    ]);
    expect(cost).toBe(170_000);
  });
});
