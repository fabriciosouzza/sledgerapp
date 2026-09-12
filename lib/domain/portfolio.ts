// Investments (PROMPT.md §5.7): an asset's balance is the running sum of its
// movements. No quotes. Yield is not income and never touches the savings rate.

import { addMonths, periodOf } from "./dates";
import { ratio } from "./money";
import type { Asset, AssetClass, AssetMovement, MovementKind, Period } from "./types";

export function movementSign(kind: MovementKind): 1 | -1 {
  switch (kind) {
    case "contribution":
    case "yield":
    case "market_adjustment":
      return 1;
    case "withdrawal":
    case "fee_tax":
      return -1;
  }
}

export interface PortfolioSummary {
  /** contributions − withdrawals: the user's own money still in. */
  contributedCents: number;
  /** yield + market adjustment − fees: what the money made. */
  earnedCents: number;
  balanceCents: number;
  /** earned / contributed, `null` when nothing was contributed. */
  returnRate: number | null;
}

export function summarize(movements: Pick<AssetMovement, "kind" | "amountCents">[]): PortfolioSummary {
  let contributed = 0;
  let earned = 0;
  for (const m of movements) {
    switch (m.kind) {
      case "contribution":
        contributed += m.amountCents;
        break;
      case "withdrawal":
        contributed -= m.amountCents;
        break;
      case "yield":
      case "market_adjustment":
        earned += m.amountCents;
        break;
      case "fee_tax":
        earned -= m.amountCents;
        break;
    }
  }
  return {
    contributedCents: contributed,
    earnedCents: earned,
    balanceCents: contributed + earned,
    returnRate: ratio(earned, contributed),
  };
}

export function assetBalance(movements: Pick<AssetMovement, "kind" | "amountCents">[]): number {
  return summarize(movements).balanceCents;
}

export function balanceByAsset(movements: AssetMovement[]): Map<string, PortfolioSummary> {
  const grouped = new Map<string, AssetMovement[]>();
  for (const m of movements) {
    const list = grouped.get(m.assetId) ?? [];
    list.push(m);
    grouped.set(m.assetId, list);
  }
  return new Map([...grouped].map(([assetId, list]) => [assetId, summarize(list)]));
}

export function balanceByClass(
  assets: Pick<Asset, "id" | "assetClass">[],
  movements: AssetMovement[],
): Map<AssetClass, number> {
  const classOf = new Map(assets.map((a) => [a.id, a.assetClass]));
  const out = new Map<AssetClass, number>();
  for (const [assetId, summary] of balanceByAsset(movements)) {
    const assetClass = classOf.get(assetId);
    if (assetClass === undefined) continue;
    out.set(assetClass, (out.get(assetClass) ?? 0) + summary.balanceCents);
  }
  return out;
}

export interface PortfolioPoint {
  period: Period;
  contributedCents: number;
  earnedCents: number;
}

/** Cumulative contributed vs earned at the end of each period, for the stacked area. */
export function portfolioSeries(movements: AssetMovement[], from: Period, to: Period): PortfolioPoint[] {
  const sorted = [...movements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: PortfolioPoint[] = [];
  let i = 0;
  const running: AssetMovement[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) {
    while (i < sorted.length && periodOf(sorted[i].date) <= p) running.push(sorted[i++]);
    const s = summarize(running);
    out.push({ period: p, contributedCents: s.contributedCents, earnedCents: s.earnedCents });
  }
  return out;
}

/** Balance of everything up to and including `period`; what net worth uses. */
export function investmentsAt(movements: Pick<AssetMovement, "kind" | "amountCents" | "date">[], period: Period): number {
  return assetBalance(movements.filter((m) => periodOf(m.date) <= period));
}
