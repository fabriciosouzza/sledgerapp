// The Today screen (PROMPT.md §7 /): "what do I need to do right now".
// Composes the other services; computes nothing new.

import { addDays, addMonths, periodOf } from "@/lib/domain/dates";
import { entryTiming, type PeriodMetrics } from "@/lib/domain/metrics";
import type { NetWorthPoint } from "@/lib/domain/netWorth";
import type { Entry, IsoDate } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { cardsOverview, type CardsOverview } from "./cards";
import { netWorthOverview } from "./netWorth";
import { monthSummary } from "./summary";

export interface TodayOverview {
  today: IsoDate;
  cashCents: number | null;
  /** Σ planned expenses due in the next 7 days, today included. */
  dueSoonCents: number;
  metrics: PeriodMetrics;
  overdue: Entry[];
  upcoming: Entry[];
  cards: CardsOverview;
  netWorth: NetWorthPoint[];
}

const OVERDUE_MONTHS_BACK = 3;
const UPCOMING_DAYS = 7;

export async function todayOverview(repos: Repositories, userId: string, today: IsoDate): Promise<TodayOverview> {
  const period = periodOf(today);
  const [summary, planned, cards, netWorth] = await Promise.all([
    monthSummary(repos, userId, period),
    repos.entries.list(userId, { status: "planned", from: `${addMonths(period, -OVERDUE_MONTHS_BACK)}-01`, to: addDays(today, UPCOMING_DAYS) }),
    cardsOverview(repos, userId, today),
    netWorthOverview(repos, userId, today),
  ]);

  const overdue = planned.filter((e) => entryTiming(e, today) === "overdue").sort((a, b) => (a.date < b.date ? -1 : 1));
  const upcoming = planned.filter((e) => entryTiming(e, today) === "upcoming").sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    today,
    cashCents: netWorth.cashCents,
    dueSoonCents: upcoming.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amountCents, 0),
    metrics: summary.metrics,
    overdue,
    upcoming,
    cards,
    netWorth: netWorth.series,
  };
}
