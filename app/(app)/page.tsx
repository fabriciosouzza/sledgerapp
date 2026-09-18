import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { Stat } from "@/components/month/stat";
import { OverdueBlock } from "@/components/today/overdue-block";
import { StatementsDue } from "@/components/today/statements-due";
import { QuickActions } from "@/components/today/quick-actions";
import { addDays, formatDate, formatDayMonth, formatPeriodShort, periodOf, today } from "@/lib/domain/dates";
import { formatBRLWrap } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { todayOverview } from "@/lib/services/today";

/** How far ahead the agenda looks. */
const UPCOMING_WINDOW = 7;

/** First name — unless the name is short or shared ("Carla e Bruno"), which stays whole. */
function greetingName(name: string): string {
  return name.length <= 20 ? name : name.split(" ")[0];
}

/**
 * The agenda (DESIGN.md 2026-09-18): what needs paying or settling, however
 * old and up to a week ahead, with the cash it comes out of. The month is
 * Review's, the accounts are Accounts', the wealth is Net worth's — Today
 * borrows only the one number it needs beside what is due.
 */
export default async function TodayPage() {
  const now = today();
  const horizon = addDays(now, UPCOMING_WINDOW);
  const { user, userId, repos } = await getContext();
  const [overview, accounts, categories] = await Promise.all([
    todayOverview(repos, userId, now),
    listAccounts(repos, userId),
    listCategories(repos, userId),
  ]);
  const lookups = buildLookups(accounts, categories);
  const initial = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();
  // "Due by" also counts statements and what is already late, which sit in the block above, not in the list it links to: say so.
  const dueStatements = overview.statementsDue.filter((s) => s.daysToDue <= UPCOMING_WINDOW);
  const lateEntries = overview.overdue.filter((e) => e.kind !== "income").length;
  const dueIncludes = [
    dueStatements.length === 1
      ? `${dueStatements[0].card.name} ${formatPeriodShort(periodOf(dueStatements[0].view.statement.cycleEnd))}`
      : dueStatements.length > 1
        ? `${dueStatements.length} card statements`
        : null,
    lateEntries > 0 ? `${lateEntries} overdue` : null,
  ].filter(Boolean);
  // The tile opens every planned entry paid from cash up to the horizon, the late ones included, so the list starts at the oldest of them.
  const dueFrom = overview.overdue.reduce<string>((min, e) => (e.date < min ? e.date : min), now);

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

      {/* One DOM order for every width: what needs you, then the cash it comes out of, then the week. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        <div className="space-y-6 min-w-0 lg:sticky lg:top-8 lg:self-start">
          {/* First when there is something to pay or settle; empty (and hidden) otherwise. Both children
              always sit here, so the overdue block keeps a just-settled row on screen across refreshes. */}
          <section aria-label="Needs you" className="space-y-3 empty:hidden">
            <StatementsDue
              items={overview.statementsDue}
              cashAccounts={overview.cashAccounts.filter((b) => b.account.isActive).map((b) => ({ id: b.account.id, name: b.account.name, type: b.account.type, balanceCents: b.balanceCents }))}
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

          {/* The one borrowed number: can what is due be paid? Accounts has the rest. */}
          <section aria-label="Cash on hand">
            {overview.cashCents !== null ? (
              <Link
                href="/accounts"
                className="-mx-2 block rounded-lg px-2 py-1 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <p className="text-sm text-muted-foreground">Cash on hand</p>
                {/* Fits the screen yet still grows with text zoom (the rem floor); at 200% "R$" wraps above the digits instead of clipping. */}
                <p className="text-[clamp(1.5rem,10vw,2.25rem)] leading-[1.1] font-semibold tracking-tight tabular-nums">
                  {formatBRLWrap(overview.cashCents)}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  from what you recorded · by account
                  <ArrowRight className="size-3" aria-hidden />
                </p>
              </Link>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">Cash on hand</p>
                <p className="text-4xl font-semibold tracking-tight text-muted-foreground">—</p>
                <Link
                  href="/settings/accounts/new"
                  className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Landmark className="size-4" aria-hidden />
                  Add a cash account with its balance
                </Link>
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-2" aria-label="This week">
            <Stat
              label={`Due by ${formatDayMonth(horizon)}`}
              hint={dueIncludes.length > 0 ? `incl. ${dueIncludes.join(" · ")}` : undefined}
              cents={overview.dueSoonCents}
              href={`/entries?status=planned&account=cash&from=${dueFrom}&to=${horizon}`}
              className={overview.toReceiveCount === 0 ? "col-span-2" : undefined}
            />
            {overview.toReceiveCount > 0 && (
              <Stat
                label="To receive"
                cents={overview.toReceiveCents}
                hint={`${overview.toReceiveCount} ${overview.toReceiveCount === 1 ? "entry" : "entries"}`}
                href={`/entries?kind=income&status=planned&from=${overview.toReceiveFrom ?? now}&to=${horizon}`}
              />
            )}
          </section>
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
              emptyMessage={`Nothing due until ${formatDayMonth(horizon)}.`}
            />
          </section>

          <QuickActions dueToday={overview.dueToday} pending={overview.pendingGeneration} />
        </div>
      </div>
    </div>
  );
}
