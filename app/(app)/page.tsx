import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { CardTile } from "@/components/cards/card-tile";
import { NetWorthLine } from "@/components/charts/net-worth-line";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { Button } from "@/components/ui/button";
import { formatDate, periodOf, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { todayOverview } from "@/lib/services/today";

export default async function TodayPage() {
  const now = today();
  const { userId, repos } = await getContext();
  const [overview, accounts, categories] = await Promise.all([todayOverview(repos, userId, now), listAccounts(repos, userId), listCategories(repos, userId)]);
  const lookups = buildLookups(accounts, categories);
  const m = overview.metrics;
  const period = periodOf(now);
  const latest = overview.netWorth[overview.netWorth.length - 1];

  return (
    <>
      <PageHeader
        title="Today"
        description={formatDate(now)}
        action={
          <Button render={<Link href="/add" />} nativeButton={false} size="lg" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        }
      />
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-2" aria-label="At a glance">
          <Stat label="Cash on hand" cents={overview.cashCents} hint={overview.cashCents === null ? "add a snapshot" : "latest snapshot"} />
          <Stat label="Due in 7 days" cents={overview.dueSoonCents} tone={overview.dueSoonCents > 0 ? "negative" : "neutral"} />
          <Stat label="Leftover this month" cents={m.leftoverCents} tone="signed" />
          <Stat label="Savings rate" rate={m.savingsRate} tone="signed" hint={m.savingsRateExBenefits !== null && m.benefitsCents > 0 ? `${(m.savingsRateExBenefits * 100).toFixed(1)}% ex-benefits` : undefined} />
        </section>

        {overview.overdue.length > 0 && (
          <section aria-label="Overdue" className="rounded-xl border border-red-500/40 bg-red-500/5 p-3">
            <h2 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
              Overdue · {overview.overdue.length} · {formatBRL(overview.overdue.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amountCents, 0))}
            </h2>
            <EntryList initial={overview.overdue} period={period} filters={{ status: "planned" }} lookups={lookups} today={now} infinite={false} ascending />
          </section>
        )}

        <section aria-label="Upcoming">
          <h2 className="mb-2 text-sm font-semibold">Next 7 days</h2>
          <EntryList
            initial={overview.upcoming}
            period={period}
            filters={{ status: "planned" }}
            lookups={lookups}
            today={now}
            infinite={false}
            selectable={false}
            ascending
            emptyMessage="Nothing due in the next 7 days."
          />
        </section>

        {overview.cards.cards.length > 0 && (
          <section aria-label="Cards">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Cards · {formatBRL(overview.cards.totalDebtCents)} owed</h2>
              <Link href="/cards" className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                All <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
              {overview.cards.cards.map((card) => (
                <CardTile key={card.account.id} card={card} className="w-40 shrink-0" />
              ))}
            </div>
          </section>
        )}

        <section aria-label="Net worth" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Net worth · 12 months</h2>
            <Link href="/net-worth" className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {latest?.netWorthCents !== null && latest?.netWorthCents !== undefined ? formatBRL(latest.netWorthCents) : "No snapshot this month"}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          <NetWorthLine data={overview.netWorth} height={72} compact />
        </section>
      </div>
    </>
  );
}
