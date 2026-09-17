// Credit card statement cycles (PROMPT.md §5.6). Plural: every function takes
// the card's own closing and due days; nothing here assumes one card.

import { addDays, addMonths, clampDay, daysBetween, periodOf } from "./dates";
import { sumCents } from "./money";
import type { Entry, IsoDate, Statement } from "./types";

export interface CardCycle {
  cycleStart: IsoDate;
  cycleEnd: IsoDate;
  dueDate: IsoDate;
}

/**
 * The cycle a purchase belongs to. A cycle closes *on* `closingDay`
 * (inclusive); a purchase after it lands in the next cycle. The due date is
 * `dueDay` in the closing month when it comes after the closing day, otherwise
 * in the month after. Days are clamped to short months.
 */
export function resolveCycle(closingDay: number, dueDay: number, purchaseDate: IsoDate): CardCycle {
  assertDay(closingDay, "closingDay");
  assertDay(dueDay, "dueDay");

  const purchasePeriod = periodOf(purchaseDate);
  const closesThisMonth = purchaseDate <= clampDay(purchasePeriod, closingDay);
  const closingPeriod = closesThisMonth ? purchasePeriod : addMonths(purchasePeriod, 1);

  const cycleEnd = clampDay(closingPeriod, closingDay);
  const cycleStart = addDays(clampDay(addMonths(closingPeriod, -1), closingDay), 1);
  const duePeriod = dueDay > closingDay ? closingPeriod : addMonths(closingPeriod, 1);
  const dueDate = clampDay(duePeriod, dueDay);

  return { cycleStart, cycleEnd, dueDate };
}

function assertDay(day: number, name: string): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`${name} must be an integer between 1 and 31`);
  }
}

/** Cycle for a card as stored on its account row. */
export function resolveCardCycle(
  card: { closingDay: number | null; dueDay: number | null },
  purchaseDate: IsoDate,
): CardCycle {
  if (card.closingDay === null || card.dueDay === null) {
    throw new RangeError("account is not a credit card");
  }
  return resolveCycle(card.closingDay, card.dueDay, purchaseDate);
}

/**
 * What a statement is worth: card expenses minus refunds credited to the card.
 * Transfers (the payment itself) and contributions never count (§5.2).
 */
export function statementTotal(entries: Pick<Entry, "kind" | "amountCents">[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.kind === "expense") total += e.amountCents;
    else if (e.kind === "income") total -= e.amountCents;
  }
  return total;
}

export interface StatementBalance {
  paidOn: IsoDate | null;
  totalCents: number;
}

/** Debt across every card: unpaid statements only, never cash (§5.6). */
export function totalCardDebt(statements: StatementBalance[]): number {
  return sumCents(statements.filter((s) => s.paidOn === null).map((s) => s.totalCents));
}

export function isStatementOpen(statement: Pick<Statement, "cycleEnd">, today: IsoDate): boolean {
  return statement.cycleEnd >= today;
}

/** Days until the due date; negative when it has passed. */
export function daysToDue(statement: Pick<Statement, "dueDate">, today: IsoDate): number {
  return daysBetween(today, statement.dueDate);
}

export interface CycleGroup {
  cycle: CardCycle;
  entries: Entry[];
  totalCents: number;
}

/**
 * Card entries grouped into the cycles they belong to, newest first. Only
 * purchases and refunds: the transfer that pays a statement is not part of
 * the next one.
 */
export function groupByCycle(card: { closingDay: number | null; dueDay: number | null }, entries: Entry[]): CycleGroup[] {
  const groups = new Map<IsoDate, CycleGroup>();
  for (const e of entries) {
    if (e.kind !== "expense" && e.kind !== "income") continue;
    const cycle = resolveCardCycle(card, e.date);
    const group = groups.get(cycle.cycleStart) ?? { cycle, entries: [], totalCents: 0 };
    group.entries.push(e);
    groups.set(cycle.cycleStart, group);
  }
  for (const g of groups.values()) g.totalCents = statementTotal(g.entries);
  return [...groups.values()].sort((a, b) => (a.cycle.cycleStart < b.cycle.cycleStart ? 1 : -1));
}

/**
 * Debt owed at the end of `until`: every card purchase made by then whose
 * statement was not paid by then — open cycles included, because what was
 * bought is already owed.
 */
export function debtAt(
  statements: { paidOn: IsoDate | null; entries: Pick<Entry, "date" | "kind" | "amountCents">[] }[],
  until: IsoDate,
): number {
  return statements
    .filter((s) => s.paidOn === null || s.paidOn > until)
    .reduce((sum, s) => sum + statementTotal(s.entries.filter((e) => e.date <= until)), 0);
}

export interface CreditCarry {
  paidOn: IsoDate | null;
  /** The statement's own purchases minus refunds. */
  ownCents: number;
}

/**
 * A statement whose refunds and cashback exceed its purchases is a credit,
 * not a bill: nothing to pay, and the surplus carries into the next unpaid
 * statement, as the issuer does. Input oldest first; returns, in the same
 * order, what each statement is worth to pay (`totalCents`, never below zero)
 * and the credit it received from earlier ones (`carriedCents`, ≤ 0).
 */
export function carryCredits(statements: CreditCarry[]): { totalCents: number; carriedCents: number }[] {
  let credit = 0;
  return statements.map((s) => {
    if (s.paidOn !== null) return { totalCents: s.ownCents, carriedCents: 0 };
    const carriedCents = credit;
    const net = s.ownCents + credit;
    credit = net < 0 ? net : 0;
    return { totalCents: Math.max(net, 0), carriedCents };
  });
}
