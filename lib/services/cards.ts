// Credit cards, plural (PROMPT.md §5.6). Statements are created lazily from
// the card's entries; a card's balance is its unpaid statements — debt, never
// cash. Paying a statement is a transfer (§5.2), never an expense.

import { isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { addDays, addMonths, formatPeriodShort, periodOf } from "@/lib/domain/dates";
import {
  daysToDue,
  groupByCycle,
  isStatementOpen,
  resolveCardCycle,
  totalCardDebt,
  type CycleGroup,
} from "@/lib/domain/statements";
import type { Account, Entry, IsoDate, Statement } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { ServiceError } from "./errors";

export interface StatementView {
  statement: Statement;
  entries: Entry[];
  totalCents: number;
  isOpen: boolean;
  daysToDue: number;
}

export interface CardView {
  account: Account;
  /** The cycle containing today, even when it has no entries yet. */
  open: StatementView;
  /** Closed cycles, newest first. */
  past: StatementView[];
  /** Σ unpaid statements, open included. */
  debtCents: number;
  /** Installment parts in cycles after the open one — money the card has already committed. */
  futureCents: number;
  futureParts: number;
  /** (debt + future installments) / credit limit, `null` without a limit — what the bank shows. */
  limitUsage: number | null;
}

export interface StatementDue {
  card: Account;
  view: StatementView;
  /** Negative when overdue. */
  daysToDue: number;
}

export interface CardsOverview {
  cards: CardView[];
  totalDebtCents: number;
  /** Closed, unpaid, with something on them — what actually needs paying, oldest first. */
  toPay: StatementDue[];
}

/** How far back the screen looks. A year of statements is plenty for a phone. */
const MONTHS_BACK = 12;
/** How far ahead installments are counted against the limit. */
const FUTURE_MONTHS = 36;

export interface CardsOptions {
  /** "open": create only the open statement row (Today); "all": every cycle with entries (/cards). */
  ensure?: "open" | "all";
}

async function buildCard(repos: Repositories, userId: string, card: Account, today: IsoDate, ensure: "open" | "all"): Promise<CardView> {
  // A year back — or further, so an old unpaid statement never drops off the screen it is paid from.
  const known = new Map((await repos.statements.listByAccount(userId, card.id)).map((s) => [s.cycleStart, s]));
  const oldestUnpaid = [...known.values()].filter((s) => s.paidOn === null).reduce<IsoDate | null>((min, s) => (min === null || s.cycleStart < min ? s.cycleStart : min), null);
  const yearBack = `${addMonths(periodOf(today), -MONTHS_BACK)}-01`;
  const from = oldestUnpaid !== null && oldestUnpaid < yearBack ? oldestUnpaid : yearBack;
  const to = resolveCardCycle(card, today).cycleEnd;
  const [entries, future] = await Promise.all([
    repos.entries.list(userId, { accountId: card.id, from, to }),
    repos.entries.list(userId, { accountId: card.id, status: "planned", from: addDays(to, 1), to: `${addMonths(periodOf(to), FUTURE_MONTHS)}-28` }),
  ]);

  const groups = groupByCycle(card, entries);
  const current = resolveCardCycle(card, today);
  if (!groups.some((g) => g.cycle.cycleStart === current.cycleStart)) {
    groups.unshift({ cycle: current, entries: [], totalCents: 0 });
  }

  // Statement rows, created lazily, one per (card, cycle_start). Rows already
  // known are reused without a write; the open cycle is always materialised.
  const views: StatementView[] = [];
  for (const group of groups) {
    let statement = known.get(group.cycle.cycleStart);
    if (!statement) {
      // Cycles that are closed and never paid are due: they get a row even on Today.
      const closedWithTotal = group.cycle.cycleEnd < today && group.totalCents > 0;
      if (ensure === "open" && group.cycle.cycleStart !== current.cycleStart && !closedWithTotal) {
        views.push({ statement: { id: "", accountId: card.id, ...group.cycle, paidOn: null }, entries: group.entries, totalCents: group.totalCents, isOpen: false, daysToDue: daysToDue(group.cycle, today) });
        continue;
      }
      statement = await repos.statements.ensure(userId, { accountId: card.id, ...group.cycle, paidOn: null });
    }
    const stale = group.entries.filter((e) => e.statementId !== statement.id).map((e) => e.id);
    if (stale.length > 0) await repos.entries.updateMany(userId, stale, { statementId: statement.id });
    views.push({
      statement,
      entries: group.entries,
      totalCents: group.totalCents,
      isOpen: isStatementOpen(statement, today),
      daysToDue: daysToDue(statement, today),
    });
  }

  const open = views.find((v) => v.statement.cycleStart === current.cycleStart)!;
  const past = views.filter((v) => v !== open);
  const debtCents = totalCardDebt(views.map((v) => ({ paidOn: v.statement.paidOn, totalCents: v.totalCents })));
  const futureCents = future.reduce((sum, e) => sum + (e.kind === "expense" ? e.amountCents : -e.amountCents), 0);

  return {
    account: card,
    open,
    past,
    debtCents,
    futureCents,
    futureParts: future.length,
    limitUsage: card.creditLimitCents ? (debtCents + futureCents) / card.creditLimitCents : null,
  };
}

export async function cardsOverview(repos: Repositories, userId: string, today: IsoDate, options: CardsOptions = {}): Promise<CardsOverview> {
  const accounts = await repos.accounts.list(userId);
  const cards = accounts.filter((a) => isCreditCard(a) && a.isActive);
  const views: CardView[] = [];
  for (const card of cards) views.push(await buildCard(repos, userId, card, today, options.ensure ?? "all"));
  const toPay: StatementDue[] = views
    .flatMap((c) => c.past.filter((s) => s.statement.paidOn === null && s.totalCents > 0).map((view) => ({ card: c.account, view, daysToDue: view.daysToDue })))
    .sort((a, b) => a.daysToDue - b.daysToDue);
  return { cards: views, totalDebtCents: views.reduce((sum, c) => sum + c.debtCents, 0), toPay };
}

export interface PayStatementInput {
  statementId: string;
  fromAccountId: string;
  paidOn: IsoDate;
}

/** Creates the transfer cash → card for the statement's total and marks it paid. */
export async function payStatement(repos: Repositories, userId: string, input: PayStatementInput, today: IsoDate): Promise<Entry> {
  const statement = await repos.statements.getById(userId, input.statementId);
  if (!statement) throw new ServiceError("not_found", "Statement not found.");
  if (statement.paidOn !== null) throw new ServiceError("invalid", "This statement is already paid.");
  if (statement.cycleEnd >= today) throw new ServiceError("invalid", "This statement is still open; pay it after it closes.");

  const [card, from] = await Promise.all([
    repos.accounts.getById(userId, statement.accountId),
    repos.accounts.getById(userId, input.fromAccountId),
  ]);
  if (!card || !isCreditCard(card)) throw new ServiceError("invalid", "Statement is not on a card.");
  if (!from || !isCashAccount(from)) throw new ServiceError("invalid", "Pay from a cash account.");

  const view = await buildCard(repos, userId, card, today, "all");
  const target = [view.open, ...view.past].find((v) => v.statement.id === statement.id);
  const total = target?.totalCents ?? 0;
  if (total <= 0) throw new ServiceError("invalid", "There is nothing to pay on this statement.");

  const entry = await repos.entries.insert(userId, {
    date: input.paidOn,
    settledOn: input.paidOn,
    kind: "transfer",
    status: "settled",
    amountCents: total,
    description: `Fatura ${card.name} ${formatPeriodShort(periodOf(statement.cycleEnd))}`,
    categoryId: null,
    accountId: from.id,
    counterAccountId: card.id,
    notes: null,
    source: "manual",
    recurrenceId: null,
    period: null,
    installmentGroupId: null,
    installmentNo: null,
    installmentTotal: null,
    statementId: statement.id,
  });
  await repos.statements.setPaidOn(userId, statement.id, input.paidOn);
  // Installment parts on this statement happen now that it is paid.
  const pending = (target?.entries ?? []).filter((e) => e.status === "planned").map((e) => e.id);
  if (pending.length > 0) await repos.entries.updateMany(userId, pending, { status: "settled", settledOn: input.paidOn });
  return entry;
}

export async function unpayStatement(repos: Repositories, userId: string, statementId: string): Promise<void> {
  const statement = await repos.statements.getById(userId, statementId);
  if (!statement) throw new ServiceError("not_found", "Statement not found.");
  if (statement.paidOn === null) throw new ServiceError("invalid", "This statement is not paid.");
  const rows = await repos.entries.list(userId, { statementId });
  const payments = rows.filter((e) => e.kind === "transfer");
  await repos.entries.deleteMany(userId, payments.map((e) => e.id));
  // What the payment settled goes back to waiting.
  const settledByPayment = rows.filter((e) => e.kind !== "transfer" && e.installmentGroupId !== null && e.settledOn === statement.paidOn).map((e) => e.id);
  if (settledByPayment.length > 0) await repos.entries.updateMany(userId, settledByPayment, { status: "planned", settledOn: null });
  await repos.statements.setPaidOn(userId, statementId, null);
}

export type { CycleGroup };
