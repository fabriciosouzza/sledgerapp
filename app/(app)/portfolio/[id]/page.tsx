import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { MovementList } from "@/components/portfolio/movement-list";
import { Button } from "@/components/ui/button";
import { assetClassLabel } from "@/lib/domain/assets";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { assetDetail } from "@/lib/services/portfolio";

export default async function AssetPage(props: PageProps<"/portfolio/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const detail = await assetDetail(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  const { asset, summary } = detail;

  return (
    <>
      <PageHeader back={{ href: "/portfolio", label: "Portfolio" }}
        title={asset.name}
        description={[assetClassLabel(asset.assetClass), asset.subclass, asset.broker].filter(Boolean).join(" · ")}
        action={
          <Button variant="ghost" size="icon-lg" aria-label="Edit asset" className="size-11" render={<Link href={`/settings/assets/${asset.id}`} />} nativeButton={false}>
            <Settings2 aria-hidden />
          </Button>
        }
      />
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-2">
          <Stat label="Balance" cents={summary.balanceCents} className="col-span-2" />
          <Stat label="Invested" cents={summary.contributedCents} />
          <Stat label="Earned" cents={summary.earnedCents} tone="signed" />
        </section>
        <Button render={<Link href={`/portfolio/new?asset=${asset.id}`} />} nativeButton={false} className="h-11 w-full">
          <Plus data-icon="inline-start" aria-hidden />
          Add movement
        </Button>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Movements</h2>
          <MovementList movements={detail.movements} />
        </section>
      </div>
    </>
  );
}
