// Net worth (PROMPT.md §5.9): a manual snapshot of cash and debt accounts plus
// investments derived from movements. A month without a snapshot is `null`,
// never zero — zero is a lie that ruins the chart.

import { periodOf } from "./dates";
import type { BalanceSnapshot, Period } from "./types";

export interface NetWorthPoint {
  period: Period;
  cashCents: number | null;
  debtCents: number | null;
  investmentsCents: number;
  netWorthCents: number | null;
}

export function netWorthFor(snapshots: BalanceSnapshot[], investmentsCents: number): NetWorthPoint | null {
  if (snapshots.length === 0) return null;
  let cash = 0;
  let debt = 0;
  for (const s of snapshots) {
    if (s.kind === "cash") cash += s.amountCents;
    else debt += s.amountCents;
  }
  return {
    period: periodOf(snapshots[0].period),
    cashCents: cash,
    debtCents: debt,
    investmentsCents,
    netWorthCents: cash + investmentsCents - debt,
  };
}

/**
 * One point per requested period. `investmentsAt(period)` is injected so this
 * module does not depend on how investments are derived.
 */
export function netWorthSeries(
  periods: Period[],
  snapshots: BalanceSnapshot[],
  investmentsAt: (period: Period) => number,
): NetWorthPoint[] {
  const byPeriod = new Map<Period, BalanceSnapshot[]>();
  for (const s of snapshots) {
    const p = periodOf(s.period);
    const list = byPeriod.get(p) ?? [];
    list.push(s);
    byPeriod.set(p, list);
  }
  return periods.map((period) => {
    const investments = investmentsAt(period);
    return (
      netWorthFor(byPeriod.get(period) ?? [], investments) ?? {
        period,
        cashCents: null,
        debtCents: null,
        investmentsCents: investments,
        netWorthCents: null,
      }
    );
  });
}

/** Cash on hand from the latest snapshot at or before `period`; `null` when there is none. */
export function latestCash(snapshots: BalanceSnapshot[], period: Period): number | null {
  const candidates = snapshots.filter((s) => s.kind === "cash" && periodOf(s.period) <= period);
  if (candidates.length === 0) return null;
  const latest = candidates.reduce((max, s) => (s.period > max ? s.period : max), candidates[0].period);
  let cash = 0;
  for (const s of candidates) if (s.period === latest) cash += s.amountCents;
  return cash;
}
