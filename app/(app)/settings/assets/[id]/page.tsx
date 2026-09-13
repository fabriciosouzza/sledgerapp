import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { today } from "@/lib/domain/dates";
import { PageHeader } from "@/components/layout/page-header";
import { AssetForm } from "@/components/settings/asset-form";
import { Button } from "@/components/ui/button";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { getAsset } from "@/lib/services/portfolio";
import { deleteAssetAction, updateAssetAction } from "../actions";

export default async function EditAssetPage(props: PageProps<"/settings/assets/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const asset = await getAsset(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  return (
    <>
      <PageHeader
        title={asset.name}
        action={
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-lg" aria-label="Delete asset" className="size-11">
                <Trash2 aria-hidden />
              </Button>
            }
            title="Delete this asset?"
            description="Only possible while it has no movements. Otherwise deactivate it."
            confirmLabel="Delete"
            action={deleteAssetAction}
            fields={{ id: asset.id }}
          />
        }
      />
      <AssetForm asset={asset} action={updateAssetAction} today={today()} />
    </>
  );
}
