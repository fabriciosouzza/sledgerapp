import { AlertTriangle } from "lucide-react";
import { NetWorthLine } from "@/components/charts/net-worth-line";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month/month-picker";
import { Stat } from "@/components/month/stat";
import { SnapshotForm } from "@/components/net-worth/snapshot-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPeriodLong, isPeriod, periodOf, today } from "@/lib/domain/dates";
import { getContext } from "@/lib/services/context";
import { netWorthOverview } from "@/lib/services/netWorth";

export default async function NetWorthPage(props: PageProps<"/net-worth">) {
  const sp = await props.searchParams;
  const now = today();
  const period = typeof sp.month === "string" && isPeriod(sp.month) ? sp.month : periodOf(now);
  const { userId, repos } = await getContext();
  const overview = await netWorthOverview(repos, userId, now, period);
  const current = overview.current;
  const currentMissing = current === null || current.netWorthCents === null;

  return (
    <>
      <PageHeader title="Net worth" description="cash + investments − debt" />
      <div className="space-y-6">
        {currentMissing && (
          <Alert>
            <AlertTriangle aria-hidden />
            <AlertDescription>No snapshot for {formatPeriodLong(periodOf(now))} yet. Fill in the balances below so this month counts.</AlertDescription>
          </Alert>
        )}

        <section className="grid grid-cols-2 gap-2" aria-label="Current">
          <Stat label={`Net worth · ${formatPeriodLong(current?.period ?? periodOf(now))}`} cents={current?.netWorthCents ?? null} tone="signed" className="col-span-2" />
          <Stat label="Cash" cents={current?.cashCents ?? null} />
          <Stat label="Debt" cents={current?.debtCents ?? null} tone="negative" />
          <Stat label="Investments" cents={current?.investmentsCents ?? null} hint="from movements" className="col-span-2" />
        </section>

        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-2 text-sm font-semibold">Last 12 months</h2>
          <NetWorthLine data={overview.series} />
        </section>

        <section className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Snapshot</h2>
          <MonthPicker period={period} basePath="/net-worth" />
          <SnapshotForm key={period} period={period} lines={overview.form.lines} hasSnapshot={overview.form.hasSnapshot} />
        </section>
      </div>
    </>
  );
}
