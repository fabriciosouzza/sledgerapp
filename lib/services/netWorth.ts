// Net worth (DESIGN.md, replacing PROMPT.md §5.9's snapshots): every part is
// derived. Cash from accounts and their settled entries, investments from
// asset movements, debt from unpaid card statements — for any month.

import { isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { addMonths, periodEnd, periodOf, periodRange, periodStart } from "@/lib/domain/dates";
import { balancesAt, cashAt, type AccountBalance } from "@/lib/domain/balances";
import { netWorthSeries, type NetWorthPoint } from "@/lib/domain/netWorth";
import { investmentsAt } from "@/lib/domain/portfolio";
import { debtAt, groupByCycle } from "@/lib/domain/statements";
import type { Account, Entry, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";

export interface NetWorthOverview {
  accounts: Account[];
  series: NetWorthPoint[];
  current: NetWorthPoint;
  /** Each cash account today; `null` before its opening date. */
  balances: AccountBalance[];
  cashCents: number | null;
}

/** Cash accounts' entries from the earliest opening date: one bounded query. */
async function cashEntries(repos: Repositories, userId: string, accounts: Account[], until: IsoDate): Promise<Entry[]> {
  const cash = accounts.filter(isCashAccount);
  if (cash.length === 0) return [];
  const from = cash.reduce((min, a) => (a.openingOn < min ? a.openingOn : min), cash[0].openingOn);
  return repos.entries.list(userId, { touchingAccountIds: cash.map((a) => a.id), settledFrom: from, settledTo: until, status: "settled" });
}

/**
 * Card purchases grouped by statement, for debt at any month end. Reaches
 * back to the range's start or the oldest unpaid statement, whichever is
 * earlier, so an old unpaid statement is never forgotten.
 */
async function cardStatements(repos: Repositories, userId: string, accounts: Account[], from: IsoDate, until: IsoDate) {
  const cards = accounts.filter(isCreditCard);
  if (cards.length === 0) return [];
  const statements = await repos.statements.listByUser(userId);
  const oldestUnpaid = statements.filter((s) => s.paidOn === null).reduce<IsoDate | null>((min, s) => (min === null || s.cycleStart < min ? s.cycleStart : min), null);
  const start = oldestUnpaid !== null && oldestUnpaid < from ? oldestUnpaid : from;
  const entries = await repos.entries.list(userId, { touchingAccountIds: cards.map((c) => c.id), from: start, to: until });
  const paidOn = new Map(statements.map((s) => [`${s.accountId}:${s.cycleStart}`, s.paidOn]));
  return cards.flatMap((card) =>
    groupByCycle(card, entries.filter((e) => e.accountId === card.id)).map((g) => ({
      paidOn: paidOn.get(`${card.id}:${g.cycle.cycleStart}`) ?? null,
      entries: g.entries,
    })),
  );
}

export async function netWorthOverview(repos: Repositories, userId: string, today: IsoDate, months = 12): Promise<NetWorthOverview> {
  const current = periodOf(today);
  const from = addMonths(current, -(months - 1));
  const accounts = await repos.accounts.list(userId);
  const [entries, movements, statements] = await Promise.all([
    cashEntries(repos, userId, accounts, today),
    repos.movements.list(userId),
    cardStatements(repos, userId, accounts, periodStart(addMonths(from, -2)), today),
  ]);

  const endOf = (p: Period) => (p === current ? today : periodEnd(p));
  const series = netWorthSeries(periodRange(from, current), {
    cashAt: (p) => cashAt(accounts, entries, endOf(p)),
    investmentsAt: (p) => investmentsAt(movements, p),
    debtAt: (p) => debtAt(statements, endOf(p)),
  });

  return {
    accounts,
    series,
    current: series[series.length - 1],
    balances: balancesAt(accounts, entries, today),
    cashCents: cashAt(accounts, entries, today),
  };
}

/** Σ cash balances at the end of `period` (today when it is the current month). */
export async function cashAtPeriod(repos: Repositories, userId: string, period: Period, today: IsoDate): Promise<number | null> {
  const accounts = await repos.accounts.list(userId);
  const until = period >= periodOf(today) ? today : periodEnd(period);
  const entries = await cashEntries(repos, userId, accounts, until);
  return cashAt(accounts, entries, until);
}
