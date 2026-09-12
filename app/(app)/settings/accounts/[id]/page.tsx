import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "@/components/settings/account-form";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/services/accounts";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { deleteAccountAction, updateAccountAction } from "../actions";

export default async function EditAccountPage(props: PageProps<"/settings/accounts/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const account = await getAccount(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });

  return (
    <>
      <PageHeader
        title={account.name}
        action={
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-lg" aria-label="Delete account" className="size-11">
                <Trash2 aria-hidden />
              </Button>
            }
            title="Delete this account?"
            description="Only possible when nothing refers to it. Otherwise deactivate it and it disappears from the pickers."
            confirmLabel="Delete"
            action={deleteAccountAction}
            fields={{ id: account.id }}
          />
        }
      />
      <AccountForm account={account} action={updateAccountAction} />
    </>
  );
}
