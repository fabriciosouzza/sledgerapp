import { describe, expect, it } from "vitest";
import { addDays, daysInMonth, toIsoDate } from "../dates";
import { daysToDue, isStatementOpen, resolveCycle, statementTotal, totalCardDebt } from "../statements";
import { entry } from "./fixtures";

describe("resolveCycle", () => {
  // Acceptance 14: two cards with different closing days resolve the same
  // purchase date to different cycles; a purchase after the closing day lands
  // in the next cycle.
  it("puts the same purchase in different cycles for different cards", () => {
    const cardA = resolveCycle(5, 15, "2026-11-10");
    const cardB = resolveCycle(20, 28, "2026-11-10");

    expect(cardA).toEqual({ cycleStart: "2026-11-06", cycleEnd: "2026-12-05", dueDate: "2026-12-15" });
    expect(cardB).toEqual({ cycleStart: "2026-10-21", cycleEnd: "2026-11-20", dueDate: "2026-11-28" });
  });

  it("closes on the closing day inclusive; the day after starts the next cycle", () => {
    expect(resolveCycle(20, 28, "2026-11-20").cycleEnd).toBe("2026-11-20");
    expect(resolveCycle(20, 28, "2026-11-21")).toEqual({
      cycleStart: "2026-11-21",
      cycleEnd: "2026-12-20",
      dueDate: "2026-12-28",
    });
  });

  it("puts the due date in the next month when it is before the closing day", () => {
    expect(resolveCycle(25, 5, "2026-11-10")).toEqual({
      cycleStart: "2026-10-26",
      cycleEnd: "2026-11-25",
      dueDate: "2026-12-05",
    });
  });

  it("clamps closing day 31 in February and keeps cycles contiguous", () => {
    expect(resolveCycle(31, 10, "2026-02-15")).toEqual({
      cycleStart: "2026-02-01",
      cycleEnd: "2026-02-28",
      dueDate: "2026-03-10",
    });
    expect(resolveCycle(31, 10, "2026-03-01").cycleStart).toBe("2026-03-01");
  });

  it("always contains the purchase date and never overlaps", () => {
    for (const closingDay of [1, 5, 15, 28, 30, 31]) {
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= daysInMonth(2026, month); day++) {
          const date = toIsoDate(2026, month, day);
          const cycle = resolveCycle(closingDay, 10, date);
          expect(cycle.cycleStart <= date, `${closingDay} ${date}`).toBe(true);
          expect(date <= cycle.cycleEnd, `${closingDay} ${date}`).toBe(true);
          expect(cycle.dueDate > cycle.cycleEnd).toBe(true);
          const next = resolveCycle(closingDay, 10, addDays(cycle.cycleEnd, 1));
          expect(next.cycleStart).toBe(addDays(cycle.cycleEnd, 1));
        }
      }
    }
  });

  it("rejects days outside 1..31", () => {
    expect(() => resolveCycle(0, 10, "2026-11-10")).toThrow(RangeError);
    expect(() => resolveCycle(10, 32, "2026-11-10")).toThrow(RangeError);
  });
});

describe("statementTotal", () => {
  // Acceptance 3 (statement side): the purchase counts, the payment transfer does not.
  it("sums card expenses, subtracts refunds, ignores transfers", () => {
    const total = statementTotal([
      entry({ kind: "expense", amountCents: 10_000 }),
      entry({ kind: "expense", amountCents: 2_500 }),
      entry({ kind: "income", amountCents: 500 }),
      entry({ kind: "transfer", amountCents: 12_000, counterAccountId: "acc-card" }),
    ]);
    expect(total).toBe(12_000);
  });
});

describe("totalCardDebt", () => {
  // Acceptance 15: total card debt sums every card and excludes paid statements.
  it("sums unpaid statements across cards", () => {
    const debt = totalCardDebt([
      { paidOn: null, totalCents: 120_000 }, // card A, open
      { paidOn: "2026-10-15", totalCents: 95_000 }, // card A, paid
      { paidOn: null, totalCents: 30_000 }, // card B, open
      { paidOn: null, totalCents: 45_000 }, // card B, closed but unpaid
    ]);
    expect(debt).toBe(195_000);
  });

  it("is zero with nothing owed", () => {
    expect(totalCardDebt([])).toBe(0);
    expect(totalCardDebt([{ paidOn: "2026-10-15", totalCents: 1 }])).toBe(0);
  });
});

describe("open statements", () => {
  it("is open until the closing day and counts days to due", () => {
    const s = { cycleEnd: "2026-11-20", dueDate: "2026-11-28" };
    expect(isStatementOpen(s, "2026-11-20")).toBe(true);
    expect(isStatementOpen(s, "2026-11-21")).toBe(false);
    expect(daysToDue(s, "2026-11-21")).toBe(7);
    expect(daysToDue(s, "2026-11-30")).toBe(-2);
  });
});
