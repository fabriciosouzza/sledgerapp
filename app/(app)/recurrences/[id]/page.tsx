import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { RecurrenceForm } from "@/components/recurrences/recurrence-form";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/domain/dates";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { listAssets } from "@/lib/services/portfolio";
import { ServiceError } from "@/lib/services/errors";
import { getRecurrence } from "@/lib/services/recurrences";
import { deleteRecurrenceAction, updateRecurrenceAction } from "../actions";

export default async function EditRecurrencePage(props: PageProps<"/recurrences/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const recurrence = await getRecurrence(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  const [accounts, categories, assets] = await Promise.all([listAccounts(repos, userId), listCategories(repos, userId), listAssets(repos, userId)]);

  return (
    <>
      <PageHeader back={{ href: "/recurrences", label: "Recurrences" }}
        title={recurrence.description}
        action={
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-lg" aria-label="Delete recurrence" className="size-11">
                <Trash2 aria-hidden />
              </Button>
            }
            title="Delete this recurrence?"
            description="Only a template that never ran can be deleted. One that already generated entries is deactivated instead (Active switch below): the entries stay, no new ones are created."
            confirmLabel="Delete"
            action={deleteRecurrenceAction}
            fields={{ id: recurrence.id }}
          />
        }
      />
      <RecurrenceForm
        recurrence={recurrence}
        accounts={accounts.filter((a) => a.isActive || a.id === recurrence.accountId || a.id === recurrence.counterAccountId)}
        categories={categories.filter((c) => c.isActive || c.id === recurrence.categoryId)}
        assets={assets.filter((a) => a.isActive || recurrence.allocations.some((s) => s.assetId === a.id))}
        today={today()}
        action={updateRecurrenceAction}
      />
    </>
  );
}
