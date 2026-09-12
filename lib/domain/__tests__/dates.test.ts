import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampDay,
  daysBetween,
  daysInMonth,
  formatDate,
  formatPeriodShort,
  isIsoDate,
  isPeriod,
  periodEnd,
  periodRange,
  periodStart,
  today,
} from "../dates";

describe("clampDay", () => {
  // Acceptance 8: due day 31 produces 28 or 29 in February.
  it("clamps day 31 to 28 in a common February", () => {
    expect(clampDay("2026-02", 31)).toBe("2026-02-28");
  });

  it("clamps day 31 to 29 in a leap February", () => {
    expect(clampDay("2028-02", 31)).toBe("2028-02-29");
  });

  it("clamps day 31 to 30 in short months and leaves long months alone", () => {
    expect(clampDay("2026-04", 31)).toBe("2026-04-30");
    expect(clampDay("2026-03", 31)).toBe("2026-03-31");
    expect(clampDay("2026-02", 10)).toBe("2026-02-10");
  });
});

describe("periods", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-01", -13)).toBe("2024-12");
  });

  it("has first and last days", () => {
    expect(periodStart("2026-02")).toBe("2026-02-01");
    expect(periodEnd("2026-02")).toBe("2026-02-28");
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it("lists an inclusive range", () => {
    expect(periodRange("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(periodRange("2026-11", "2026-10")).toEqual([]);
  });

  it("validates", () => {
    expect(isPeriod("2026-11")).toBe(true);
    expect(isPeriod("2026-13")).toBe(false);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
});

describe("days", () => {
  it("adds and subtracts days across months", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(daysBetween("2026-11-08", "2026-11-01")).toBe(-7);
  });
});

describe("today", () => {
  it("is the date in São Paulo, not UTC", () => {
    // 01:00 UTC on the 6th is still the 5th in São Paulo (UTC−3).
    expect(today(new Date("2026-11-06T01:00:00Z"))).toBe("2026-11-05");
    expect(today(new Date("2026-11-06T03:30:00Z"))).toBe("2026-11-06");
  });
});

describe("formatting", () => {
  it("uses pt-BR dates and short English periods", () => {
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
    expect(formatPeriodShort("2026-10")).toBe("Oct/26");
    expect(formatPeriodShort("2027-09")).toBe("Sep/27");
  });
});
