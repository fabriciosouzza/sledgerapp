// Net worth = cash + investments − debt, each derived: cash from accounts and
// their entries (balances.ts), investments from asset movements
// (portfolio.ts), debt from unpaid card statements (statements.ts). A month
// before any account existed is `null`, never zero.

import type { Period } from "./types";

export interface NetWorthPoint {
  period: Period;
  cashCents: number | null;
  debtCents: number;
  investmentsCents: number;
  netWorthCents: number | null;
}

export function netWorthFor(period: Period, cashCents: number | null, investmentsCents: number, debtCents: number): NetWorthPoint {
  return {
    period,
    cashCents,
    debtCents,
    investmentsCents,
    netWorthCents: cashCents === null ? null : cashCents + investmentsCents - debtCents,
  };
}

/** One point per period from the three derivations, injected so this stays pure. */
export function netWorthSeries(
  periods: Period[],
  derive: { cashAt: (period: Period) => number | null; investmentsAt: (period: Period) => number; debtAt: (period: Period) => number },
): NetWorthPoint[] {
  return periods.map((period) => netWorthFor(period, derive.cashAt(period), derive.investmentsAt(period), derive.debtAt(period)));
}
