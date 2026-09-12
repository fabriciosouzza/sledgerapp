import Link from "next/link";
import { EntryForm } from "@/components/entries/entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { SeedButton } from "@/components/settings/seed-button";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/domain/dates";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";

const KINDS = ["expense", "income", "transfer", "contribution"] as const;

export default async function AddPage(props: PageProps<"/add">) {
  const sp = await props.searchParams;
  const kind = KINDS.find((k) => k === sp.kind);
  const { userId, repos } = await getContext();
  const [accounts, categories] = await Promise.all([listAccounts(repos, userId), listCategories(repos, userId)]);
  const activeAccounts = accounts.filter((a) => a.isActive);
  const activeCategories = categories.filter((c) => c.isActive);

  if (activeAccounts.length === 0) {
    return (
      <>
        <PageHeader title="Add" />
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">An entry needs an account. Add one first.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button render={<Link href="/settings/accounts/new" />} nativeButton={false} className="h-11">
              Add account
            </Button>
            <SeedButton />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Add" />
      <EntryForm key={kind ?? "any"} accounts={activeAccounts} categories={activeCategories} today={today()} defaultKind={kind} />
    </>
  );
}
