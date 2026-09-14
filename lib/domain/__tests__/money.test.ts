import { describe, expect, it } from "vitest";
import { cashFlowSign, digitsToCents, formatBRL, formatBRLWhole, formatBRLWrap, formatPercent, parseBRL, ratio, splitCents, sumCents } from "../money";

const plain = (s: string) => s.replace(/ /g, " ");

describe("formatBRLWrap", () => {
  it("keeps the figure and lets the symbol wrap", () => {
    expect(formatBRLWrap(5_364_978)).toBe("R$ 53.649,78");
  });
});

describe("formatPercent", () => {
  it("shows one decimal below 100% and drops a trailing .0", () => {
    expect(formatPercent(0.355)).toBe("35.5%");
    expect(formatPercent(0.4)).toBe("40%");
    expect(formatPercent(-0.123)).toBe("-12.3%");
    expect(formatPercent(1.234)).toBe("123%");
  });
});

describe("formatBRL", () => {
  it("formats cents as pt-BR currency", () => {
    expect(plain(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(plain(formatBRL(5))).toBe("R$ 0,05");
    expect(plain(formatBRL(0))).toBe("R$ 0,00");
  });

  it("keeps the sign of negative cents", () => {
    expect(plain(formatBRL(-14990))).toBe("-R$ 149,90");
  });
});

describe("digitsToCents", () => {
  it("treats every typed digit as one more cent", () => {
    expect(digitsToCents("14990")).toBe(14990);
    expect(digitsToCents("5")).toBe(5);
    expect(digitsToCents("")).toBe(0);
    expect(digitsToCents("1.499,0")).toBe(14990);
  });
});

describe("parseBRL", () => {
  it("parses pt-BR amounts", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 149,90")).toBe(14990);
    expect(parseBRL("150")).toBe(15000);
    expect(parseBRL("0,5")).toBe(50);
    expect(parseBRL("-10,00")).toBe(-1000);
  });

  it("rejects garbage", () => {
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("1,234.56")).toBeNull();
    expect(parseBRL("")).toBeNull();
  });
});

describe("ratio", () => {
  it("returns null instead of dividing by zero", () => {
    expect(ratio(10, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
  });
});

describe("splitCents", () => {
  it("splits exactly, remainder on the first part", () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(sumCents(splitCents(99999, 7))).toBe(99999);
    expect(() => splitCents(100, 0)).toThrow(RangeError);
  });
});

describe("cashFlowSign", () => {
  it("only income and expense move the needle", () => {
    expect(cashFlowSign("income")).toBe(1);
    expect(cashFlowSign("expense")).toBe(-1);
    expect(cashFlowSign("contribution")).toBe(0);
    expect(cashFlowSign("transfer")).toBe(0);
  });
});

describe("formatBRLWhole", () => {
  it("drops the cents and rounds", () => {
    expect(plain(formatBRLWhole(1_393_800))).toBe("R$ 13.938");
    expect(plain(formatBRLWhole(384_720))).toBe("R$ 3.847");
    expect(plain(formatBRLWhole(50))).toBe("R$ 1");
  });
});
