// The Today screen (PROMPT.md §7 /, DESIGN.md §2): "what do I need to do
// right now". Composes the other services; the only new rule is the insight.

import { isCreditCard } from "@/lib/domain/accounts";
import { addDays, addMonths, periodOf } from "@/lib/domain/dates";
import { monthInsight, type Insight } from "@/lib/domain/insights";
import { computeMetrics, entryTiming, type PeriodMetrics } from "@/lib/domain/metrics";
import type { NetWorthPoint } from "@/lib/domain/netWorth";
import type { Account, Entry, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { cardsOverview, type CardsOverview, type StatementDue } from "./cards";
import { netWorthOverview } from "./netWorth";
import { previewGeneration } from "./recurrences";
import { monthSummary } from "./summary";

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
  /** Σ planned money leaving cash in the next 7 days (expenses, transfers out, contributions) plus card statements due by then, overdue included. */
  dueSoonCents: number;
  /** Card statements closed and unpaid, oldest first. */
  statementsDue: StatementDue[];
  /** Planned entries due today (for "settle all due today"). */
  dueTodayIds: string[];
  metrics: PeriodMetrics;
  insight: Insight | null;
  accounts: AccountTile[];
  /** Recurrences this month still to generate. */
  toGenerate: number;
  overdue: Entry[];
  upcoming: Entry[];
  cards: CardsOverview;
  netWorth: NetWorthPoint[];
}

const UPCOMING_DAYS = 7;

export async function todayOverview(repos: Repositories, userId: string, today: IsoDate): Promise<TodayOverview> {
  const period = periodOf(today);
  const previousPeriod = addMonths(period, -1);
  const netWorth = await netWorthOverview(repos, userId, today);
  const [summary, previousEntries, planned, cards, generation, categories] = await Promise.all([
    monthSummary(repos, userId, period, { today, cashCents: netWorth.cashCents }),
    repos.entries.list(userId, { period: previousPeriod }),
    // Planned rows only: whatever is still due, however old, plus the next days.
    repos.entries.list(userId, { status: "planned", to: addDays(today, UPCOMING_DAYS) }),
    cardsOverview(repos, userId, today, { ensure: "open" }),
    previewGeneration(repos, userId, period),
    repos.categories.list(userId),
  ]);

  const previous = previousEntries.length > 0 ? computeMetrics({ entries: previousEntries, categories, recurrences: [], cashCents: null }) : null;
  // Card purchases are paid through their statement, never one by one (§5.6).
  const cardIds = new Set(netWorth.accounts.filter(isCreditCard).map((a) => a.id));
  const toSettle = planned.filter((e) => !cardIds.has(e.accountId));
  const overdue = toSettle.filter((e) => entryTiming(e, today) === "overdue").sort((a, b) => (a.date < b.date ? -1 : 1));
  const upcoming = toSettle.filter((e) => entryTiming(e, today) === "upcoming").sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    today,
    period,
    cashCents: netWorth.cashCents,
    dueSoonCents:
      upcoming.filter((e) => e.kind !== "income").reduce((sum, e) => sum + e.amountCents, 0) +
      cards.toPay.filter((s) => s.daysToDue <= UPCOMING_DAYS).reduce((sum, s) => sum + s.view.totalCents, 0),
    statementsDue: cards.toPay,
    dueTodayIds: upcoming.filter((e) => e.date === today).map((e) => e.id),
    metrics: summary.metrics,
    insight: monthInsight(summary.metrics, previous),
    accounts: netWorth.balances
      .filter((b) => b.account.isActive)
      .sort((a, b) => Number(b.balanceCents !== null && b.balanceCents !== 0) - Number(a.balanceCents !== null && a.balanceCents !== 0)),
    toGenerate: generation.toCreate.length,
    overdue,
    upcoming,
    cards,
    netWorth: netWorth.series,
  };
}
