import Link from "next/link";
import { RecordBatchForm } from "@/components/portfolio/record-batch-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/domain/dates";
import { getContext } from "@/lib/services/context";
import { assetBalances, listAssets } from "@/lib/services/portfolio";

export default async function RecordBatchPage() {
  const { userId, repos } = await getContext();
  const [assets, balances] = await Promise.all([listAssets(repos, userId), assetBalances(repos, userId)]);
  const active = assets.filter((a) => a.isActive);

  if (active.length === 0) {
    return (
      <>
        <PageHeader back={{ href: "/portfolio", label: "Portfolio" }} title="Record the month" />
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">Add an asset first.</p>
          <Button render={<Link href="/settings/assets/new" />} nativeButton={false} className="mt-4 h-11">
            Add asset
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader back={{ href: "/portfolio", label: "Portfolio" }} title="Record the month" description="One line per asset: type the yield, or what the broker shows and let the difference be recorded. Blank lines are skipped." />
      <RecordBatchForm assets={active.map((a) => ({ id: a.id, name: a.name, broker: a.broker, assetClass: a.assetClass, balanceCents: balances[a.id] ?? 0 }))} today={today()} />
    </>
  );
}
