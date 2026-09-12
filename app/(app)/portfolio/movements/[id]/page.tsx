import { notFound } from "next/navigation";
import { MovementForm } from "@/components/portfolio/movement-form";
import { PageHeader } from "@/components/layout/page-header";
import { movementKindLabel } from "@/lib/domain/assets";
import { today } from "@/lib/domain/dates";
import { listAccounts } from "@/lib/services/accounts";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { assetBalances, getMovement, listAssets } from "@/lib/services/portfolio";

export default async function EditMovementPage(props: PageProps<"/portfolio/movements/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const movement = await getMovement(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  const [assets, accounts, balances] = await Promise.all([listAssets(repos, userId), listAccounts(repos, userId), assetBalances(repos, userId)]);
  return (
    <>
      <PageHeader title={movementKindLabel(movement.kind)} description={movement.entryId ? "Paired with a cash entry, which follows the amount and the date." : undefined} />
      <MovementForm assets={assets} accounts={accounts.filter((a) => a.isActive)} balances={balances} today={today()} movement={movement} />
    </>
  );
}
