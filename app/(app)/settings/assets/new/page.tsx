import { today } from "@/lib/domain/dates";
import { PageHeader } from "@/components/layout/page-header";
import { AssetForm } from "@/components/settings/asset-form";
import { createAssetAction } from "../actions";

export default function NewAssetPage() {
  return (
    <>
      <PageHeader title="New asset" />
      <AssetForm action={createAssetAction} today={today()} />
    </>
  );
}
