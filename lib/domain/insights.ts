// The one-sentence insight on Today (DESIGN.md §2). Pure: picks the most
// useful true statement from this month's metrics and last month's; says
// nothing rather than guessing.

import { formatBRL, ratio } from "./money";
import type { PeriodMetrics } from "./metrics";

export interface Insight {
  headline: string;
  detail: string | null;
  /** 0..1 for the ring, `null` to hide it. */
  ring: number | null;
  tone: "good" | "bad" | "neutral";
}

const pct = (r: number) => `${Math.abs(Math.round(r * 100))}%`;

/** Fewer days than this and a comparison with last month says more about timing than about spending. */
const MIN_COMPARABLE_DAY = 7;

/**
 * `previous` must cover the same span as `current`: the whole month, or up to
 * `throughDay` when the month is in progress (the caller cuts it).
 */
export function monthInsight(current: PeriodMetrics, previous: PeriodMetrics | null, options: { throughDay?: number | null } = {}): Insight | null {
  const throughDay = options.throughDay ?? null;
  const comparable = throughDay === null || throughDay >= MIN_COMPARABLE_DAY;
  const change =
    comparable && previous && previous.expenseCents > 0 && current.expenseCents > 0 ? ratio(current.expenseCents - previous.expenseCents, previous.expenseCents) : null;
  const rate = current.savingsRate;
  const rateDetail =
    rate === null
      ? null
      : `Savings rate ${pct(rate)}${current.savingsRateExBenefits !== null && current.benefitsCents > 0 ? ` · ${pct(current.savingsRateExBenefits)} ex-benefits` : ""}`;

  if (change !== null && Math.abs(change) >= 0.01) {
    const down = change < 0;
    return {
      headline: `Spending ${down ? "down" : "up"} ${pct(change)} vs ${throughDay === null ? "last month" : `the same point last month`}`,
      detail: rateDetail ?? `${formatBRL(current.expenseCents)} so far`,
      ring: rate,
      tone: down ? "good" : "bad",
    };
  }

  if (rate !== null) {
    return {
      headline: rate >= 0 ? `You kept ${pct(rate)} of what came in` : `Spending exceeds income by ${pct(-rate)}`,
      detail: current.benefitsCents > 0 && current.savingsRateExBenefits !== null ? `${pct(current.savingsRateExBenefits)} without benefits` : `${formatBRL(current.incomeCents - current.expenseCents)} left after expenses`,
      ring: rate,
      tone: rate >= 0.2 ? "good" : rate >= 0 ? "neutral" : "bad",
    };
  }

  if (current.plannedExpenseCents > 0) {
    return {
      headline: `${formatBRL(current.plannedExpenseCents)} still to settle this month`,
      detail: current.expenseCents > 0 ? `${formatBRL(current.expenseCents)} settled so far` : null,
      ring: null,
      tone: "neutral",
    };
  }

  return null;
}
