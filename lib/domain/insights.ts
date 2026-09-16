// The one-sentence insight on Today (DESIGN.md §2). Pure: picks the most
// useful true statement from this month's metrics and last month's; says
// nothing rather than guessing.

import { formatBRL, formatPercent, ratio } from "./money";
import type { PeriodMetrics } from "./metrics";

export interface Insight {
  headline: string;
  detail: string | null;
  /** 0..1 for the ring, `null` to hide it. */
  ring: number | null;
  tone: "good" | "bad" | "neutral";
}

const pct = (r: number) => `${Math.abs(Math.round(r * 100))}%`;
/** Rates read as on Review: one decimal below 100%, no trailing ".0". */
const share = (r: number) => formatPercent(Math.abs(r));

/** Fewer days than this and a comparison with last month says more about timing than about spending. */
const MIN_COMPARABLE_DAY = 7;

/**
 * `previous` must cover the same span as `current`: the whole month, or up to
 * `throughDay` when the month is in progress (the caller cuts it).
 */
export function monthInsight(
  current: PeriodMetrics,
  previous: PeriodMetrics | null,
  options: { throughDay?: number | null; rollingRate?: number | null; capsOver?: { name: string; overCents: number }[] } = {},
): Insight | null {
  const throughDay = options.throughDay ?? null;
  // Irregular income makes the month's rate swing; the 12-month one is the honest number.
  const rolling = options.rollingRate ?? null;
  const rollingDetail = rolling === null ? null : `12-month rate ${rolling < 0 ? "−" : ""}${share(rolling)}`;
  const comparable = throughDay === null || throughDay >= MIN_COMPARABLE_DAY;
  const change =
    comparable && previous && previous.expenseCents > 0 && current.expenseCents > 0 ? ratio(current.expenseCents - previous.expenseCents, previous.expenseCents) : null;
  const rate = current.savingsRate;
  const rateDetail =
    rate === null
      ? null
      : `Savings rate ${share(rate)}${current.savingsRateExEarmarked !== null && current.earmarkedCents > 0 ? ` · ${share(current.savingsRateExEarmarked)} ex-earmarked` : ""}`;

  // A blown cap is news the owner can act on this week: it outranks how spending compares with last month.
  const capsOver = options.capsOver ?? [];
  if (capsOver.length > 0) {
    return {
      headline: capsOver.length === 1 ? `${capsOver[0].name} is ${formatBRL(capsOver[0].overCents)} over its cap` : `${capsOver.length} categories over their cap`,
      detail: rateDetail,
      ring: rate,
      tone: "bad",
    };
  }

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
      headline: rate >= 0 ? `You kept ${share(rate)} of what came in` : `Spending exceeds income by ${share(rate)}`,
      detail:
        rate < 0 && rollingDetail
          ? `${rollingDetail} · this month is not over`
          : current.earmarkedCents > 0 && current.savingsRateExEarmarked !== null
            ? `${share(current.savingsRateExEarmarked)} ex-earmarked`
            : `${formatBRL(current.incomeCents - current.expenseCents)} left after expenses`,
      ring: rate,
      tone: rate >= 0.2 ? "good" : rate >= 0 ? "neutral" : "bad",
    };
  }

  if (current.plannedExpenseCents > 0) {
    return {
      headline: `${formatBRL(current.plannedExpenseCents)} still to settle this month`,
      detail: [current.expenseCents > 0 ? `${formatBRL(current.expenseCents)} settled so far` : null, rollingDetail].filter(Boolean).join(" · ") || null,
      ring: null,
      tone: "neutral",
    };
  }

  return null;
}
