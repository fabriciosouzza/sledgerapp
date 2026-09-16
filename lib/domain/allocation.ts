// Where a contribution goes (PROMPT.md §5.2): a settled contribution is split
// across assets, one paired movement per asset, and the parts must add up to
// the entry. A recurring contribution may carry a default split in percent
// (§5.5); amounts come out of it by largest remainder, so they always sum.

import type { AllocationLine, AssetMovement, Entry, EntryKind, MovementKind, RecurrenceShare } from "./types";

/** The movement a settled contribution or redemption pairs with. */
export function movementKindFor(kind: EntryKind): MovementKind | null {
  if (kind === "contribution") return "contribution";
  if (kind === "redemption") return "withdrawal";
  return null;
}

export function allocationTotal(lines: Pick<AllocationLine, "amountCents">[]): number {
  return lines.reduce((sum, l) => sum + l.amountCents, 0);
}

/** Why an allocation cannot settle `amountCents`, or `null` when it can. */
export function allocationProblem(lines: AllocationLine[], amountCents: number): string | null {
  if (lines.length === 0) return "Pick at least one asset.";
  if (lines.some((l) => !Number.isInteger(l.amountCents) || l.amountCents <= 0)) return "Every part must be more than zero.";
  if (new Set(lines.map((l) => l.assetId)).size !== lines.length) return "An asset appears twice.";
  const total = allocationTotal(lines);
  if (total !== amountCents) return total < amountCents ? "The parts do not add up to the amount." : "The parts exceed the amount.";
  return null;
}

/**
 * Largest remainder: each share gets its floor, and the cents left over go
 * one at a time to the shares with the biggest fractional part. The result
 * always sums to `amountCents`; a share that rounds to nothing is dropped.
 */
export function splitByShares(amountCents: number, shares: RecurrenceShare[]): AllocationLine[] {
  const totalShare = shares.reduce((sum, s) => sum + s.sharePercent, 0);
  if (amountCents <= 0 || totalShare <= 0) return [];
  const exact = shares.map((s) => (amountCents * s.sharePercent) / totalShare);
  const floors = exact.map(Math.floor);
  let left = amountCents - floors.reduce((sum, v) => sum + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left === 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return shares.map((s, i) => ({ assetId: s.assetId, amountCents: floors[i] })).filter((l) => l.amountCents > 0);
}

/** Percentages summing to 100 that describe how `lines` were split, for a recurrence's default. */
export function sharesFromLines(lines: AllocationLine[]): RecurrenceShare[] {
  const total = allocationTotal(lines);
  if (total <= 0) return [];
  return splitByShares(100, lines.map((l) => ({ assetId: l.assetId, sharePercent: l.amountCents }))).map((l) => ({ assetId: l.assetId, sharePercent: l.amountCents }));
}

/** Whether a set of shares is a valid default split: empty, or summing to exactly 100. */
export function sharesProblem(shares: RecurrenceShare[]): string | null {
  if (shares.length === 0) return null;
  if (shares.some((s) => !Number.isInteger(s.sharePercent) || s.sharePercent < 1 || s.sharePercent > 100)) return "Each share is a whole percentage from 1 to 100.";
  if (new Set(shares.map((s) => s.assetId)).size !== shares.length) return "An asset appears twice.";
  const total = shares.reduce((sum, s) => sum + s.sharePercent, 0);
  if (total !== 100) return `The shares add up to ${total}%, not 100%.`;
  return null;
}

/** The allocation recorded for an entry, read back from its paired movements. */
export function linesFromMovements(movements: Pick<AssetMovement, "assetId" | "amountCents">[]): AllocationLine[] {
  const byAsset = new Map<string, number>();
  for (const m of movements) byAsset.set(m.assetId, (byAsset.get(m.assetId) ?? 0) + m.amountCents);
  return [...byAsset].map(([assetId, amountCents]) => ({ assetId, amountCents }));
}

export interface Unallocated {
  entry: Entry;
  /** What the paired movements add up to; the difference to the entry is what has no destination. */
  allocatedCents: number;
}

/**
 * Settled contributions and redemptions whose paired movements do not add up
 * to them: money that left (or reached) cash with no asset behind it. Never
 * hidden (§5.2).
 */
export function unallocated(entries: Entry[], movements: Pick<AssetMovement, "entryId" | "amountCents" | "kind">[]): Unallocated[] {
  const allocated = new Map<string, number>();
  for (const m of movements) {
    if (m.entryId === null) continue;
    allocated.set(m.entryId, (allocated.get(m.entryId) ?? 0) + m.amountCents);
  }
  return entries
    .filter((e) => e.status === "settled" && movementKindFor(e.kind) !== null)
    .map((e) => ({ entry: e, allocatedCents: allocated.get(e.id) ?? 0 }))
    .filter((u) => u.allocatedCents !== u.entry.amountCents);
}
