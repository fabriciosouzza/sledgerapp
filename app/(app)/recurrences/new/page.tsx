import { PageHeader } from "@/components/layout/page-header";
import { RecurrenceForm } from "@/components/recurrences/recurrence-form";
import { today } from "@/lib/domain/dates";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { listAssets } from "@/lib/services/portfolio";
import { createRecurrenceAction } from "../actions";

export default async function NewRecurrencePage() {
  const { userId, repos } = await getContext();
  const [accounts, categories, assets] = await Promise.all([listAccounts(repos, userId), listCategories(repos, userId), listAssets(repos, userId)]);
  return (
    <>
      <PageHeader title="New recurrence" />
      <RecurrenceForm accounts={accounts.filter((a) => a.isActive)} categories={categories.filter((c) => c.isActive)} assets={assets.filter((a) => a.isActive)} today={today()} action={createRecurrenceAction} />
    </>
  );
}
