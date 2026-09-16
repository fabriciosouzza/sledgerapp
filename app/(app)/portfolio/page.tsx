import Link from "next/link";
import { AlertTriangle, ChevronRight, ListChecks, Plus } from "lucide-react";
import { ClassDonut } from "@/components/charts/class-donut";
import { PortfolioArea } from "@/components/charts/portfolio-area";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Unallocated } from "@/lib/domain/allocation";
import { assetClassLabel } from "@/lib/domain/assets";
import { formatDate, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { getContext } from "@/lib/services/context";
import { portfolioOverview } from "@/lib/services/portfolio";

/** Money that left (or reached) cash with no asset behind it: shown, never hidden (§5.2). */
function UnallocatedAlert({ rows }: { rows: Unallocated[] }) {
  if (rows.length === 0) return null;
  const missing = rows.reduce((sum, r) => sum + Math.abs(r.entry.amountCents - r.allocatedCents), 0);
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden />
      <AlertTitle>
        {formatBRL(missing)} in {rows.length} {rows.length === 1 ? "entry has" : "entries have"} no asset behind it
      </AlertTitle>
      <AlertDescription>
        <p>Settled contributions and redemptions whose split does not add up. Open each one and say where the money went.</p>
        <ul className="mt-1 space-y-1">
          {rows.map(({ entry, allocatedCents }) => (
            <li key={entry.id}>
              <Link href={`/entries/${entry.id}`} className="inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline">
                {formatDate(entry.date)} · {entry.description} · {formatBRL(entry.amountCents)}
                {allocatedCents !== 0 ? ` (${formatBRL(allocatedCents)} placed)` : ""}
                <ChevronRight className="size-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export default async function PortfolioPage() {
  const now = today();
  const { userId, repos } = await getContext();
  const overview = await portfolioOverview(repos, userId, now);
  const t = overview.total;

  if (overview.assets.length === 0) {
    return (
      <>
        <PageHeader title="Portfolio" />
        <div className="mb-4">
          <UnallocatedAlert rows={overview.unallocated} />
        </div>
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No assets yet. Add what you invest in, then record contributions and yield.</p>
          <Button render={<Link href="/settings/assets/new" />} nativeButton={false} className="mt-4 h-11">
            Add asset
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Portfolio"
        action={
          <div className="flex gap-2">
            <Button render={<Link href="/portfolio/record" />} nativeButton={false} variant="outline" size="lg" className="h-11">
              <ListChecks data-icon="inline-start" aria-hidden />
              Record month
            </Button>
            <Button render={<Link href="/portfolio/new" />} nativeButton={false} size="lg" className="h-11">
              <Plus data-icon="inline-start" aria-hidden />
              Movement
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <UnallocatedAlert rows={overview.unallocated} />
        <section className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Totals">
          <Stat label="Total balance" cents={t.balanceCents} className="col-span-2" />
          <Stat label="Contributed" cents={t.contributedCents} hint="contributions − withdrawals" />
          <Stat label="Earned" cents={t.earnedCents} tone="signed" hint="yield + adjustments − fees" />
          <Stat label="Return on contributions" rate={t.returnRate} tone="signed" className="col-span-2" />
        </section>

        {overview.byClass.length > 0 && (
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">By class</h2>
            <ClassDonut data={overview.byClass} />
          </section>
        )}

        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-1 text-sm font-semibold">Contributed vs earned, accumulated</h2>
          <p className="mb-2 text-xs text-muted-foreground">Each month shows everything up to then: your money in, and what it made on top.</p>
          <PortfolioArea data={overview.series} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Assets</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {overview.assets.map(({ asset, summary, lastMovement }) => (
              <li key={asset.id}>
                <Link href={`/portfolio/${asset.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{asset.name}</span>
                      <Badge variant="secondary">{assetClassLabel(asset.assetClass)}</Badge>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {summary.earnedCents !== 0 && (
                        <span className={summary.earnedCents < 0 ? "text-negative" : "text-positive"}>
                          {summary.earnedCents > 0 ? "+" : ""}
                          {formatBRL(summary.earnedCents)} earned
                        </span>
                      )}
                      {summary.earnedCents !== 0 && lastMovement ? " · " : ""}
                      {lastMovement ? `last ${formatDate(lastMovement)}` : "no movements"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(summary.balanceCents)}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
