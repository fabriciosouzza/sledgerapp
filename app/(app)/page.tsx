import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { NetWorthLine } from "@/components/charts/net-worth-line";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { Stat } from "@/components/month/stat";
import { AccountStrip } from "@/components/today/account-strip";
import { OverdueBlock } from "@/components/today/overdue-block";
import { StatementsDue } from "@/components/today/statements-due";
import { QuickActions } from "@/components/today/quick-actions";
import { addDays, formatDate, formatDayMonth, formatPeriodShort, periodOf, today } from "@/lib/domain/dates";
import { formatBRL, formatBRLWrap } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { todayOverview } from "@/lib/services/today";
import { cn } from "@/lib/utils";

/** How far ahead the "to receive" list looks. */
const UPCOMING_WINDOW = 7;

/** First name — unless the name is short or shared ("Carla e Bruno"), which stays whole. */
function greetingName(name: string): string {
  return name.length <= 20 ? name : name.split(" ")[0];
}

export default async function TodayPage() {
  const now = today();
  const { user, userId, repos } = await getContext();
  const [overview, accounts, categories] = await Promise.all([
    todayOverview(repos, userId, now),
    listAccounts(repos, userId),
    listCategories(repos, userId),
  ]);
  const lookups = buildLookups(accounts, categories);
  const m = overview.metrics;
  const latest = overview.netWorth[overview.netWorth.length - 1];
  const initial = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();
  // "Due by" also counts statements and what is already late, which sit in the block above, not in the list it links to: say so.
  const dueStatements = overview.statementsDue.filter((s) => s.daysToDue <= UPCOMING_WINDOW);
  const lateEntries = overview.overdue.filter((e) => e.kind !== "income").length;
  // The tile opens every planned entry paid from cash up to the horizon, the late ones included, so the list starts at the oldest of them.
  const dueFrom = overview.overdue.reduce<string>((min, e) => (e.date < min ? e.date : min), now);
  const dueIncludes = [
    dueStatements.length === 1
      ? `${dueStatements[0].card.name} ${formatPeriodShort(periodOf(dueStatements[0].view.statement.cycleEnd))}`
      : dueStatements.length > 1
        ? `${dueStatements.length} card statements`
        : null,
    lateEntries > 0 ? `${lateEntries} overdue` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{formatDate(now)}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {user.name ? `Hi, ${greetingName(user.name)}` : "Today"}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex size-11 items-center justify-center rounded-full bg-muted text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring"
        >
          {initial}
        </Link>
      </header>

      {/* One DOM order for every width: what needs you, then where you stand, then the week. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        <div className="space-y-6 min-w-0 lg:sticky lg:top-8 lg:self-start">
          {/* First when there is something to pay or settle; empty (and hidden) otherwise. Both children
              always sit here, so the overdue block keeps a just-settled row on screen across refreshes. */}
          <section aria-label="Needs you" className="space-y-3 empty:hidden">
            <StatementsDue
              items={overview.statementsDue}
              cashAccounts={overview.accounts.filter((b) => b.account.isActive).map((b) => ({ id: b.account.id, name: b.account.name, type: b.account.type, balanceCents: b.balanceCents }))}
              today={now}
            />
            <OverdueBlock hasEntries={overview.overdue.length > 0}>
              <EntryList
                initial={overview.overdue}
                period={overview.period}
                filters={{ status: "planned" }}
                lookups={lookups}
                today={now}
                infinite={false}
                selectable={false}
                ascending
                title="Overdue"
                summary
                emptyMessage=""
              />
            </OverdueBlock>
          </section>

          <section aria-label="Cash on hand" className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Cash on hand</p>
              {overview.cashCents !== null ? (
                <>
                  {/* Fits the screen yet still grows with text zoom (the rem floor); at 200% "R$" wraps above the digits instead of clipping. */}
                  <p className="text-[clamp(1.5rem,10vw,2.25rem)] leading-[1.1] font-semibold tracking-tight tabular-nums">
                    {formatBRLWrap(overview.cashCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    across your cash accounts, from what you recorded
                    {overview.savingsCents > 0 ? ` · ${formatBRL(overview.savingsCents)} of it in savings` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-semibold tracking-tight text-muted-foreground">
                    —
                  </p>
                  <Link
                    href="/settings/accounts/new"
                    className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Landmark className="size-4" aria-hidden />
                    Add a cash account with its balance
                  </Link>
                </>
              )}
            </div>

            {overview.insight && (
              <Link
                href="/review"
                className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{overview.insight.headline}</span>
                  {overview.insight.detail && (
                    <span className="text-muted-foreground"> · {overview.insight.detail}</span>
                  )}
                  <span className="sr-only"> — review the month</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            )}
          </section>

          <div className="space-y-3">
            <section className={cn("grid gap-2", overview.toReceiveCount > 0 ? "grid-cols-3" : "grid-cols-2")} aria-label="This week">
              <Stat
                label={`Due by ${formatDayMonth(addDays(now, UPCOMING_WINDOW))}`}
                hint={dueIncludes.length > 0 ? `incl. ${dueIncludes.join(" · ")}` : undefined}
                cents={overview.dueSoonCents}
                href={`/entries?status=planned&account=cash&from=${dueFrom}&to=${addDays(now, UPCOMING_WINDOW)}`}
              />
              {overview.toReceiveCount > 0 && (
                <Stat
                  label="To receive"
                  cents={overview.toReceiveCents}
                  hint={`${overview.toReceiveCount} ${overview.toReceiveCount === 1 ? "entry" : "entries"}`}
                  href={`/entries?kind=income&status=planned&from=${overview.toReceiveFrom ?? now}&to=${addDays(now, UPCOMING_WINDOW)}`}
                />
              )}
              <Stat
                label="Leftover this month"
                cents={m.leftoverCents}
                tone="signed"
                href={`/entries?month=${overview.period}`}
              />
            </section>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          <section aria-label="Upcoming">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Next 7 days</h2>
              <Link
                href="/entries"
                className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                See all <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
            <EntryList
              initial={overview.upcoming}
              period={overview.period}
              filters={{ status: "planned" }}
              lookups={lookups}
              today={now}
              infinite={false}
              selectable={false}
              ascending
              emptyMessage="Nothing due in the next 7 days."
            />
          </section>

          {/* Balances support the week, not the other way round: after what is due (DESIGN.md 2026-09-14). */}
          <AccountStrip accounts={overview.accounts} cards={overview.cards.cards} />

          <QuickActions
            dueToday={overview.dueToday}
            pending={overview.pendingGeneration}
          />

          <section
            aria-label="Net worth"
            className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Net worth · 12 months</h2>
              <Link
                href="/net-worth"
                className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {latest?.netWorthCents !== null &&
                latest?.netWorthCents !== undefined
                  ? formatBRL(latest.netWorthCents)
                  : "No snapshot this month"}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
            <NetWorthLine data={overview.netWorth} height={72} compact />
          </section>
        </div>
      </div>
    </div>
  );
}
