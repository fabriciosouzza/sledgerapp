// The Today screen (PROMPT.md §7 /, DESIGN.md §2): "what do I need to do
// right now". Composes the other services; the only new rule is the insight.

import { isCashAccount } from "@/lib/domain/accounts";
import { addDays, addMonths, periodOf } from "@/lib/domain/dates";
import { monthInsight, type Insight } from "@/lib/domain/insights";
import { computeMetrics, entryTiming, type PeriodMetrics } from "@/lib/domain/metrics";
import type { NetWorthPoint } from "@/lib/domain/netWorth";
import type { Account, Entry, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { cardsOverview, type CardsOverview } from "./cards";
import { netWorthOverview } from "./netWorth";
import { previewGeneration } from "./recurrences";
import { monthSummary } from "./summary";

export interface AccountTile {
  account: Account;
  /** Snapshot balance for the current month; `null` when not taken. */
  balanceCents: number | null;
}

export interface TodayOverview {
  today: IsoDate;
  period: Period;
  /** Latest snapshot cash and the month it was taken in. */
  cash: { cents: number; asOf: Period } | null;
  /** Σ planned expenses due in the next 7 days, today included. */
  dueSoonCents: number;
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

const OVERDUE_MONTHS_BACK = 3;
const UPCOMING_DAYS = 7;

export async function todayOverview(repos: Repositories, userId: string, today: IsoDate): Promise<TodayOverview> {
  const period = periodOf(today);
  const previousPeriod = addMonths(period, -1);
  const [summary, previousEntries, planned, cards, netWorth, generation, categories] = await Promise.all([
    monthSummary(repos, userId, period),
    repos.entries.list(userId, { period: previousPeriod }),
    repos.entries.list(userId, { status: "planned", from: `${addMonths(period, -OVERDUE_MONTHS_BACK)}-01`, to: addDays(today, UPCOMING_DAYS) }),
    cardsOverview(repos, userId, today),
    netWorthOverview(repos, userId, today),
    previewGeneration(repos, userId, period),
    repos.categories.list(userId),
  ]);

  const previous = previousEntries.length > 0 ? computeMetrics({ entries: previousEntries, categories, recurrences: [], cashCents: null }) : null;
  const overdue = planned.filter((e) => entryTiming(e, today) === "overdue").sort((a, b) => (a.date < b.date ? -1 : 1));
  const upcoming = planned.filter((e) => entryTiming(e, today) === "upcoming").sort((a, b) => (a.date < b.date ? -1 : 1));

  const cashSnapshots = netWorth.series.filter((p) => p.cashCents !== null);
  const latestCash = cashSnapshots[cashSnapshots.length - 1];

  return {
    today,
    period,
    cash: latestCash && latestCash.cashCents !== null ? { cents: latestCash.cashCents, asOf: latestCash.period } : null,
    dueSoonCents: upcoming.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amountCents, 0),
    dueTodayIds: upcoming.filter((e) => e.date === today).map((e) => e.id),
    metrics: summary.metrics,
    insight: monthInsight(summary.metrics, previous),
    accounts: netWorth.form.lines.filter((l) => isCashAccount(l.account)).map((l) => ({ account: l.account, balanceCents: l.amountCents })),
    toGenerate: generation.toCreate.length,
    overdue,
    upcoming,
    cards,
    netWorth: netWorth.series,
  };
}
