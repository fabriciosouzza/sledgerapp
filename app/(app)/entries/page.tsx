import Link from "next/link";
import { Plus } from "lucide-react";
import { EntryFilters } from "@/components/entries/entry-filters";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { addDays, formatDate, isIsoDate, isPeriod, periodOf, today } from "@/lib/domain/dates";
import type { EntryKind, EntryStatus } from "@/lib/domain/types";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { formatBRL } from "@/lib/domain/money";
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
  // A date range (from the year view, or a card's future installments) replaces the month.
  const range = isIsoDate(str(sp.from)) ? { from: str(sp.from), to: isIsoDate(str(sp.to)) ? str(sp.to) : addDays(str(sp.from), 366 * 3) } : null;

  const { userId, repos } = await getContext();
  const [accounts, categories] = await Promise.all([listAccounts(repos, userId), listCategories(repos, userId)]);
  // A parent category stands for itself and its children.
  const categoryIds = values.category ? [values.category, ...categories.filter((c) => c.parentId === values.category).map((c) => c.id)] : undefined;
  const filters = {
    kind,
    kinds: moves ? (["transfer", "contribution"] as EntryKind[]) : undefined,
    status,
    accountId: values.account || undefined,
    categoryIds,
    search: values.q || undefined,
  };
  const entries = await listEntries(repos, userId, range ? { ...filters, ...range } : { ...filters, period: month });
  const totals = {
    count: entries.length,
    inCents: entries.filter((e) => e.kind === "income").reduce((s, e) => s + e.amountCents, 0),
    outCents: entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amountCents, 0),
    movesCents: entries.filter((e) => e.kind === "transfer" || e.kind === "contribution").reduce((s, e) => s + e.amountCents, 0),
  };

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
        <EntryFilters values={values} accounts={accounts} categories={categories} range={range} />
      </div>
      {totals.count > 0 && (
        <p className="mb-3 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {totals.count} {totals.count === 1 ? "entry" : "entries"}
          {totals.inCents > 0 ? ` · in ${formatBRL(totals.inCents)}` : ""}
          {totals.outCents > 0 ? ` · out ${formatBRL(totals.outCents)}` : ""}
          {totals.movesCents > 0 ? ` · moved ${formatBRL(totals.movesCents)}` : ""}
          {range ? ` · ${formatDate(range.from)} → ${formatDate(range.to)}` : ""}
        </p>
      )}
      <EntryList
        key={JSON.stringify({ ...values, range })}
        initial={entries}
        period={month}
        filters={filters}
        lookups={buildLookups(accounts, categories)}
        today={now}
        infinite={range === null}
        emptyMessage="No entries match. Add one or load an earlier month."
      />
    </>
  );
}
