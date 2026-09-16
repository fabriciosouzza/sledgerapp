// The Today screen (PROMPT.md §7 /, DESIGN.md §2): "what do I need to do
// right now". Composes the other services; the only new rule is the insight.

import { isCreditCard } from "@/lib/domain/accounts";
import { addDays, addMonths, periodOf } from "@/lib/domain/dates";
import { monthInsight, type Insight } from "@/lib/domain/insights";
import { needsAllocation } from "@/lib/domain/entries";
import { entryTiming, type PeriodMetrics } from "@/lib/domain/metrics";
import type { NetWorthPoint } from "@/lib/domain/netWorth";
import type { Account, Entry, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { cardsOverview, type CardsOverview, type StatementDue } from "./cards";
import { netWorthOverview } from "./netWorth";
import { pendingMonths, type PendingMonth } from "./recurrences";
import { capsOver, monthSummary, yearSummary } from "./summary";

export interface AccountTile {
  account: Account;
  /** Derived balance today; `null` before the account's opening date. */
  balanceCents: number | null;
}

export interface TodayOverview {
  today: IsoDate;
  period: Period;
  /** Σ cash account balances today; `null` with no cash account yet. */
  cashCents: number | null;
  /** Σ planned money leaving cash by 7 days from now (expenses, transfers out, contributions) plus card statements due by then; what is already late counts too. */
  dueSoonCents: number;
  /** Card statements closed and unpaid, oldest first. */
  statementsDue: StatementDue[];
  /** Σ planned income, however old — what is still expected to come in. */
  toReceiveCents: number;
  toReceiveCount: number;
  /** Date of the oldest planned income, so the list can reach back to it. */
  toReceiveFrom: IsoDate | null;
  /** Part of the cash that sits in savings accounts. */
  savingsCents: number;
  /** Planned entries due today (for "settle all due today"). */
  /** Planned rows dated today that are safe to settle blind: variable bills (an estimate) and contributions (they need an allocation) are left out. */
  dueToday: Pick<Entry, "id" | "description" | "kind" | "amountCents">[];
  metrics: PeriodMetrics;
  insight: Insight | null;
  accounts: AccountTile[];
  /** Recurrences this month still to generate. */
  /** Months (last 3 + current) with recurring entries still to apply. */
  pendingGeneration: PendingMonth[];
  overdue: Entry[];
  upcoming: Entry[];
  cards: CardsOverview;
  netWorth: NetWorthPoint[];
}

const UPCOMING_DAYS = 7;

export async function todayOverview(repos: Repositories, userId: string, today: IsoDate): Promise<TodayOverview> {
  const period = periodOf(today);
  // Net worth feeds the month summary its cash figure; everything else runs alongside it.
  const netWorthPromise = netWorthOverview(repos, userId, today);
  const [netWorth, summary, planned, cards, generation, recurrences] = await Promise.all([
    netWorthPromise,
    netWorthPromise.then((n) => monthSummary(repos, userId, period, { today, cashCents: n.cashCents })),
    // Planned rows only: whatever is still due, however old, plus the next days.
    repos.entries.list(userId, { status: "planned", to: addDays(today, UPCOMING_DAYS) }),
    cardsOverview(repos, userId, today, { ensure: "open" }),
    pendingMonths(repos, userId, today),
    repos.recurrences.list(userId),
  ]);
  const variable = new Set(recurrences.filter((r) => r.isVariable).map((r) => r.id));
  // Only when the month's own rate says little (nothing in yet, or negative): one more bounded query.
  const monthRate = summary.metrics.savingsRate;
  const rollingRate =
    monthRate === null || monthRate < 0 ? (await yearSummary(repos, userId, addMonths(period, -11), period)).totals.savingsRate : null;
  // Card purchases are paid through their statement, never one by one (§5.6).
  const cardIds = new Set(netWorth.accounts.filter(isCreditCard).map((a) => a.id));
  const toSettle = planned.filter((e) => !cardIds.has(e.accountId));
  const overdue = toSettle.filter((e) => entryTiming(e, today) === "overdue").sort((a, b) => (a.date < b.date ? -1 : 1));
  const upcoming = toSettle.filter((e) => entryTiming(e, today) === "upcoming").sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    today,
    period,
    cashCents: netWorth.cashCents,
    // "Due by <date>" includes whatever is late: overdue entries as well as overdue statements.
    dueSoonCents:
      [...overdue, ...upcoming].filter((e) => e.kind !== "income").reduce((sum, e) => sum + e.amountCents, 0) +
      cards.toPay.filter((s) => s.daysToDue <= UPCOMING_DAYS).reduce((sum, s) => sum + s.view.totalCents, 0),
    statementsDue: cards.toPay,
    toReceiveCents: toSettle.filter((e) => e.kind === "income").reduce((sum, e) => sum + e.amountCents, 0),
    toReceiveCount: toSettle.filter((e) => e.kind === "income").length,
    toReceiveFrom: toSettle.filter((e) => e.kind === "income").reduce<IsoDate | null>((min, e) => (min === null || e.date < min ? e.date : min), null),
    savingsCents: netWorth.balances.filter((b) => b.account.type === "savings").reduce((sum, b) => sum + (b.balanceCents ?? 0), 0),
    dueToday: upcoming
      .filter((e) => e.date === today && !needsAllocation(e.kind) && !(e.recurrenceId !== null && variable.has(e.recurrenceId)))
      .map(({ id, description, kind, amountCents }) => ({ id, description, kind, amountCents })),
    metrics: summary.metrics,
    insight: monthInsight(summary.metrics, summary.previous, { throughDay: summary.delta.throughDay, rollingRate, capsOver: capsOver(summary.categories) }),
    accounts: netWorth.balances
      .filter((b) => b.account.isActive)
      .sort((a, b) => Number(b.balanceCents !== null && b.balanceCents !== 0) - Number(a.balanceCents !== null && a.balanceCents !== 0)),
    pendingGeneration: generation,
    overdue,
    upcoming,
    cards,
    netWorth: netWorth.series,
  };
}
