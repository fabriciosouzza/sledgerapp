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
import { Ring } from "@/components/today/ring";
import { isCashAccount } from "@/lib/domain/accounts";
import { formatDate, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { todayOverview } from "@/lib/services/today";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{formatDate(now)}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {user.name ? `Hi, ${user.name.split(" ")[0]}` : "Today"}
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

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        <div className="space-y-6 min-w-0">
          <section aria-label="Cash on hand">
            <p className="text-sm text-muted-foreground">Cash on hand</p>
            {overview.cashCents !== null ? (
              <>
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatBRL(overview.cashCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  across your cash accounts, from what you recorded
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-semibold tracking-tight text-muted-foreground">
                  —
                </p>
                <Link
                  href="/settings/accounts/new"
                  className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Landmark className="size-4" aria-hidden />
                  Add a cash account with its balance
                </Link>
              </>
            )}
          </section>

          {overview.insight && (
            <section
              aria-label="This month"
              className={cn(
                "flex items-center gap-4 rounded-xl p-4 ring-1",
                overview.insight.tone === "good" &&
                  "bg-primary/10 ring-primary/30",
                overview.insight.tone === "bad" &&
                  "bg-red-500/5 ring-red-500/30",
                overview.insight.tone === "neutral" &&
                  "bg-card ring-foreground/10",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{overview.insight.headline}</p>
                {overview.insight.detail && (
                  <p className="text-sm text-muted-foreground">
                    {overview.insight.detail}
                  </p>
                )}
                <Link
                  href="/review"
                  className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline"
                >
                  Review the month <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>
              {overview.insight.ring !== null && (
                <div className="relative">
                  <Ring
                    value={overview.insight.ring}
                    label={`Savings rate ${Math.round(overview.insight.ring * 100)}%`}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
                    {Math.round(overview.insight.ring * 100)}%
                  </span>
                </div>
              )}
            </section>
          )}

          <section className="grid grid-cols-2 gap-2" aria-label="This week">
            <Stat
              label="Due in 7 days"
              cents={overview.dueSoonCents}
              tone={overview.dueSoonCents > 0 ? "negative" : "neutral"}
              href="#upcoming"
            />
            <Stat
              label="Leftover this month"
              cents={m.leftoverCents}
              tone="signed"
              href={`/entries?month=${overview.period}`}
            />
          </section>

          <AccountStrip
            accounts={overview.accounts}
            cards={overview.cards.cards}
          />

          <QuickActions
            dueTodayIds={overview.dueTodayIds}
            toGenerate={overview.toGenerate}
          />
        </div>

        <div className="space-y-6 min-w-0">
          <StatementsDue items={overview.statementsDue} cashAccounts={accounts.filter((a) => a.isActive && isCashAccount(a))} today={now} />

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

          <section aria-label="Upcoming" id="upcoming" className="scroll-mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Next 7 days</h2>
              <Link
                href="/entries"
                className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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

          <section
            aria-label="Net worth"
            className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Net worth · 12 months</h2>
              <Link
                href="/net-worth"
                className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
