import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteEntryDialog } from "@/components/entries/delete-entry-dialog";
import { EntryForm } from "@/components/entries/entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { today } from "@/lib/domain/dates";
import { installmentLabel } from "@/lib/domain/entries";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { getEntry } from "@/lib/services/entries";
import { ServiceError } from "@/lib/services/errors";

export default async function EditEntryPage(props: PageProps<"/entries/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const entry = await getEntry(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  const [accounts, categories] = await Promise.all([listAccounts(repos, userId), listCategories(repos, userId)]);
  const parts = installmentLabel(entry);

  return (
    <>
      <PageHeader title={entry.description} description={parts ? `Installment ${parts}` : entry.recurrenceId ? "From a recurrence" : undefined} action={<DeleteEntryDialog entry={entry} />} />
      {entry.recurrenceId && (
        <p className="mb-4 -mt-2 text-sm text-muted-foreground">
          Changes here apply to this month only.{" "}
          <Link href={`/recurrences/${entry.recurrenceId}`} className="text-primary hover:underline">
            Edit the recurrence
          </Link>{" "}
          for the months to come.
        </p>
      )}
      <EntryForm
        accounts={accounts.filter((a) => a.isActive || a.id === entry.accountId || a.id === entry.counterAccountId)}
        categories={categories.filter((c) => c.isActive || c.id === entry.categoryId)}
        today={today()}
        entry={entry}
      />
    </>
  );
}
