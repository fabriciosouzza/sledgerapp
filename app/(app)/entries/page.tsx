import Link from "next/link";
import { Plus } from "lucide-react";
import { EntryFilters } from "@/components/entries/entry-filters";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { isPeriod, periodOf, today } from "@/lib/domain/dates";
import type { EntryKind, EntryStatus } from "@/lib/domain/types";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { listEntries } from "@/lib/services/entries";

const KINDS: EntryKind[] = ["income", "expense", "contribution", "transfer"];
const STATUSES: EntryStatus[] = ["planned", "settled"];

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function EntriesPage(props: PageProps<"/entries">) {
  const sp = await props.searchParams;
  const now = today();
  const month = isPeriod(str(sp.month)) ? str(sp.month) : periodOf(now);
  const kindParam = str(sp.kind);
  const kind = KINDS.find((k) => k === kindParam);
  const moves = kindParam === "moves";
  const status = STATUSES.find((s) => s === str(sp.status));
  const values = { month, kind: moves ? "moves" : (kind ?? ""), status: status ?? "", account: str(sp.account), category: str(sp.category), q: str(sp.q).trim() };

  const { userId, repos } = await getContext();
  const filters = {
    kind,
    kinds: moves ? (["transfer", "contribution"] as EntryKind[]) : undefined,
    status,
    accountId: values.account || undefined,
    categoryId: values.category || undefined,
    search: values.q || undefined,
  };
  const [entries, accounts, categories] = await Promise.all([
    listEntries(repos, userId, { ...filters, period: month }),
    listAccounts(repos, userId),
    listCategories(repos, userId),
  ]);

  return (
    <>
      <PageHeader
        title="Entries"
        action={
          <Button render={<Link href="/add" />} nativeButton={false} size="lg" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        }
      />
      <div className="mb-4">
        <EntryFilters values={values} accounts={accounts} categories={categories} />
      </div>
      <EntryList
        key={JSON.stringify(values)}
        initial={entries}
        period={month}
        filters={filters}
        lookups={buildLookups(accounts, categories)}
        today={now}
        emptyMessage="No entries match. Add one or load an earlier month."
      />
    </>
  );
}
