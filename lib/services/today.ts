// The Today screen (PROMPT.md §7 /, DESIGN.md 2026-09-18): the agenda —
// what needs paying or settling, however old and up to a week ahead, with
// the cash it would come out of. Composes the other services; no rule of
// its own beyond the window.

import { isCreditCard } from "@/lib/domain/accounts";
import { addDays, periodOf } from "@/lib/domain/dates";
import { needsAllocation } from "@/lib/domain/entries";
import { entryTiming } from "@/lib/domain/metrics";
import type { AccountBalance } from "@/lib/domain/balances";
import type { Entry, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { cardsOverview, type StatementDue } from "./cards";
import { netWorthOverview } from "./netWorth";
import { pendingMonths, type PendingMonth } from "./recurrences";

export interface TodayOverview {
  today: IsoDate;
  period: Period;
  /** Σ cash account balances today, inactive accounts still holding money included; `null` with no cash account yet. */
  cashCents: number | null;
  /** Each cash account with its balance today — what a statement can be paid from. */
  cashAccounts: AccountBalance[];
  /** Σ planned money leaving cash by 7 days from now (expenses, transfers out, contributions) plus card statements due by then; what is already late counts too. */
  dueSoonCents: number;
  /** Card statements closed and unpaid, oldest first. */
  statementsDue: StatementDue[];
  /** Σ planned income, however old — what is still expected to come in. */
  toReceiveCents: number;
  toReceiveCount: number;
  /** Date of the oldest planned income, so the list can reach back to it. */
  toReceiveFrom: IsoDate | null;
  /** Planned rows dated today that are safe to settle blind: variable bills (an estimate) and contributions (they need an allocation) are left out. */
  dueToday: Pick<Entry, "id" | "description" | "kind" | "amountCents">[];
  /** Months (last 3 + current) with recurring entries still to apply. */
  pendingGeneration: PendingMonth[];
  overdue: Entry[];
  upcoming: Entry[];
}

const UPCOMING_DAYS = 7;

export async function todayOverview(repos: Repositories, userId: string, today: IsoDate): Promise<TodayOverview> {
  const period = periodOf(today);
  const [netWorth, planned, cards, generation, recurrences] = await Promise.all([
    // One month: only the cash of today is wanted here.
    netWorthOverview(repos, userId, today, 1),
    // Planned rows only: whatever is still due, however old, plus the next days.
    repos.entries.list(userId, { status: "planned", to: addDays(today, UPCOMING_DAYS) }),
    cardsOverview(repos, userId, today, { ensure: "open" }),
    pendingMonths(repos, userId, today),
    repos.recurrences.list(userId),
  ]);
  const variable = new Set(recurrences.filter((r) => r.isVariable).map((r) => r.id));
  // Card purchases are paid through their statement, never one by one (§5.6).
  const cardIds = new Set(netWorth.accounts.filter(isCreditCard).map((a) => a.id));
  const toSettle = planned.filter((e) => !cardIds.has(e.accountId));
  const overdue = toSettle.filter((e) => entryTiming(e, today) === "overdue").sort((a, b) => (a.date < b.date ? -1 : 1));
  const upcoming = toSettle.filter((e) => entryTiming(e, today) === "upcoming").sort((a, b) => (a.date < b.date ? -1 : 1));
  const toReceive = toSettle.filter((e) => e.kind === "income");

  return {
    today,
    period,
    cashCents: netWorth.cashCents,
    cashAccounts: netWorth.balances,
    // "Due by <date>" includes whatever is late: overdue entries as well as overdue statements. A redemption brings cash in, so it is not due.
    dueSoonCents:
      [...overdue, ...upcoming].filter((e) => e.kind !== "income" && e.kind !== "redemption").reduce((sum, e) => sum + e.amountCents, 0) +
      cards.toPay.filter((s) => s.daysToDue <= UPCOMING_DAYS).reduce((sum, s) => sum + s.view.totalCents, 0),
    statementsDue: cards.toPay,
    toReceiveCents: toReceive.reduce((sum, e) => sum + e.amountCents, 0),
    toReceiveCount: toReceive.length,
    toReceiveFrom: toReceive.reduce<IsoDate | null>((min, e) => (min === null || e.date < min ? e.date : min), null),
    dueToday: upcoming
      .filter((e) => e.date === today && !needsAllocation(e.kind) && !(e.recurrenceId !== null && variable.has(e.recurrenceId)))
      .map(({ id, description, kind, amountCents }) => ({ id, description, kind, amountCents })),
    pendingGeneration: generation,
    overdue,
    upcoming,
  };
}
