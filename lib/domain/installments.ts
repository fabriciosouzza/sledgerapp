// Installment expansion (PROMPT.md §5.4): one purchase becomes N planned
// entries, one per month, sharing a group id and numbered 1..N.

import { addMonths, clampDay, dayOf, periodOf } from "./dates";
import type { EntryKind, IsoDate, NewEntry } from "./types";

export interface InstallmentPurchase {
  description: string;
  kind: Extract<EntryKind, "expense" | "income">;
  /** Amount of each part, not the total. */
  amountCents: number;
  parts: number;
  /** Date of the first part; the others fall on the same day of later months. */
  firstDate: IsoDate;
  categoryId: string;
  accountId: string;
  notes?: string | null;
  /** The first part may be born settled (§5.4). */
  firstSettledOn?: IsoDate | null;
}

export function expandInstallments(purchase: InstallmentPurchase, groupId: string): NewEntry[] {
  const { parts } = purchase;
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError("parts must be >= 1");
  if (!Number.isInteger(purchase.amountCents) || purchase.amountCents <= 0) {
    throw new RangeError("amountCents must be a positive integer");
  }

  const firstPeriod = periodOf(purchase.firstDate);
  const day = dayOf(purchase.firstDate);

  return Array.from({ length: parts }, (_, i): NewEntry => {
    const no = i + 1;
    const settledOn = no === 1 ? (purchase.firstSettledOn ?? null) : null;
    return {
      date: no === 1 ? purchase.firstDate : clampDay(addMonths(firstPeriod, i), day),
      settledOn,
      kind: purchase.kind,
      status: settledOn ? "settled" : "planned",
      amountCents: purchase.amountCents,
      description: purchase.description,
      categoryId: purchase.categoryId,
      accountId: purchase.accountId,
      counterAccountId: null,
      notes: purchase.notes ?? null,
      source: "installment",
      recurrenceId: null,
      period: null,
      installmentGroupId: groupId,
      installmentNo: no,
      installmentTotal: parts,
      statementId: null,
    };
  });
}

/** Last period an installment plan touches — for the `Oct/26 → Sep/27` preview. */
export function lastInstallmentPeriod(firstDate: IsoDate, parts: number): string {
  return addMonths(periodOf(firstDate), parts - 1);
}

export type InstallmentScope = "this" | "this_and_future" | "all";

/** Which parts of a group an edit or delete touches, given the part acted on. */
export function installmentsInScope<T extends { installmentNo: number | null }>(
  group: T[],
  actedOn: number,
  scope: InstallmentScope,
): T[] {
  switch (scope) {
    case "this":
      return group.filter((e) => e.installmentNo === actedOn);
    case "this_and_future":
      return group.filter((e) => e.installmentNo !== null && e.installmentNo >= actedOn);
    case "all":
      return group;
  }
}
