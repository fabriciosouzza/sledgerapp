import Link from "next/link";
import { MovementForm } from "@/components/portfolio/movement-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/domain/dates";
import { listAccounts } from "@/lib/services/accounts";
import { getContext } from "@/lib/services/context";
import { listAssets } from "@/lib/services/portfolio";

export default async function NewMovementPage(props: PageProps<"/portfolio/new">) {
  const sp = await props.searchParams;
  const { userId, repos } = await getContext();
  const [assets, accounts] = await Promise.all([listAssets(repos, userId), listAccounts(repos, userId)]);
  const active = assets.filter((a) => a.isActive);

  if (active.length === 0) {
    return (
      <>
        <PageHeader title="New movement" />
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
      <PageHeader title="New movement" />
      <MovementForm assets={active} accounts={accounts.filter((a) => a.isActive)} today={today()} defaultAssetId={typeof sp.asset === "string" ? sp.asset : undefined} />
    </>
  );
}
