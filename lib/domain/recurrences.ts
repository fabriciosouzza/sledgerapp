// Recurrence expansion (PROMPT.md §5.5): a template becomes one planned entry
// per period. Idempotency is the database's job (unique on recurrence+period);
// here we only decide what a period *should* contain.

import { clampDay, periodStart } from "./dates";
import { sumCents } from "./money";
import type { IsoDate, NewEntry, Period, Recurrence } from "./types";

/** The competence date of a recurrence in a period, with the day clamped. */
export function recurrenceDateIn(recurrence: Pick<Recurrence, "dueDay">, period: Period): IsoDate {
  return clampDay(period, recurrence.dueDay);
}

/**
 * Whether a recurrence has an occurrence in `period`. The occurrence is its
 * due date in that month: it must be on or after `startsOn` and on or before
 * `endsOn`. A template that starts on the 20th with due day 5 first occurs on
 * the 5th of the *following* month.
 */
export function recurrenceAppliesTo(recurrence: Recurrence, period: Period): boolean {
  if (!recurrence.isActive) return false;
  const date = recurrenceDateIn(recurrence, period);
  if (date < recurrence.startsOn) return false;
  if (recurrence.endsOn !== null && date > recurrence.endsOn) return false;
  return true;
}

export function expandRecurrence(recurrence: Recurrence, period: Period): NewEntry {
  return {
    date: recurrenceDateIn(recurrence, period),
    settledOn: null,
    kind: recurrence.kind,
    status: "planned",
    amountCents: recurrence.amountCents,
    description: recurrence.description,
    categoryId: recurrence.categoryId,
    accountId: recurrence.accountId,
    counterAccountId: recurrence.counterAccountId,
    notes: null,
    source: "recurrence",
    recurrenceId: recurrence.id,
    period: periodStart(period),
    installmentGroupId: null,
    installmentNo: null,
    installmentTotal: null,
    statementId: null,
  };
}

/** Every entry a period should contain, given the templates. */
export function expandRecurrences(recurrences: Recurrence[], period: Period): NewEntry[] {
  return recurrences.filter((r) => recurrenceAppliesTo(r, period)).map((r) => expandRecurrence(r, period));
}

/** Σ active expense recurrences — the number that sizes the emergency fund. */
export function monthlyFixedCost(recurrences: Recurrence[]): number {
  return sumCents(
    recurrences.filter((r) => r.isActive && r.kind === "expense").map((r) => r.amountCents),
  );
}
