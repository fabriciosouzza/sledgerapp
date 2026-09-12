// Credit cards, plural (PROMPT.md §5.6). Statements are created lazily from
// the card's entries; a card's balance is its unpaid statements — debt, never
// cash. Paying a statement is a transfer (§5.2), never an expense.

import { isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { addMonths, formatPeriodShort, periodOf } from "@/lib/domain/dates";
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
  /** debt / credit limit, `null` without a limit. */
  limitUsage: number | null;
}

export interface CardsOverview {
  cards: CardView[];
  totalDebtCents: number;
}

/** How far back the screen looks. A year of statements is plenty for a phone. */
const MONTHS_BACK = 12;

async function buildCard(repos: Repositories, userId: string, card: Account, today: IsoDate): Promise<CardView> {
  const from = `${addMonths(periodOf(today), -MONTHS_BACK)}-01`;
  const to = resolveCardCycle(card, today).cycleEnd;
  const entries = await repos.entries.list(userId, { accountId: card.id, from, to });

  const groups = groupByCycle(card, entries);
  const current = resolveCardCycle(card, today);
  if (!groups.some((g) => g.cycle.cycleStart === current.cycleStart)) {
    groups.unshift({ cycle: current, entries: [], totalCents: 0 });
  }

  // Statement rows, created lazily, one per (card, cycle_start).
  const views: StatementView[] = [];
  for (const group of groups) {
    const statement = await repos.statements.ensure(userId, {
      accountId: card.id,
      cycleStart: group.cycle.cycleStart,
      cycleEnd: group.cycle.cycleEnd,
      dueDate: group.cycle.dueDate,
      paidOn: null,
    });
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

  return {
    account: card,
    open,
    past,
    debtCents,
    limitUsage: card.creditLimitCents ? debtCents / card.creditLimitCents : null,
  };
}

export async function cardsOverview(repos: Repositories, userId: string, today: IsoDate): Promise<CardsOverview> {
  const accounts = await repos.accounts.list(userId);
  const cards = accounts.filter((a) => isCreditCard(a) && a.isActive);
  const views: CardView[] = [];
  for (const card of cards) views.push(await buildCard(repos, userId, card, today));
  return { cards: views, totalDebtCents: views.reduce((sum, c) => sum + c.debtCents, 0) };
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

  const [card, from] = await Promise.all([
    repos.accounts.getById(userId, statement.accountId),
    repos.accounts.getById(userId, input.fromAccountId),
  ]);
  if (!card || !isCreditCard(card)) throw new ServiceError("invalid", "Statement is not on a card.");
  if (!from || !isCashAccount(from)) throw new ServiceError("invalid", "Pay from a cash account.");

  const view = await buildCard(repos, userId, card, today);
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
  return entry;
}

export async function unpayStatement(repos: Repositories, userId: string, statementId: string): Promise<void> {
  const statement = await repos.statements.getById(userId, statementId);
  if (!statement) throw new ServiceError("not_found", "Statement not found.");
  if (statement.paidOn === null) throw new ServiceError("invalid", "This statement is not paid.");
  const payments = (await repos.entries.list(userId, { statementId })).filter((e) => e.kind === "transfer");
  await repos.entries.deleteMany(userId, payments.map((e) => e.id));
  await repos.statements.setPaidOn(userId, statementId, null);
}

export type { CycleGroup };
