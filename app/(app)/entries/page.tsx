import Link from "next/link";
import { Plus } from "lucide-react";
import { EntryFilters } from "@/components/entries/entry-filters";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { addDays, formatDate, isIsoDate, isPeriod, periodOf, today } from "@/lib/domain/dates";
import { isMove } from "@/lib/domain/entries";
import type { Entry, EntryKind, EntryStatus } from "@/lib/domain/types";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { formatBRL } from "@/lib/domain/money";
import { getContext } from "@/lib/services/context";
import { listEntries } from "@/lib/services/entries";

const KINDS: EntryKind[] = ["income", "expense", "contribution", "redemption", "transfer"];
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
    kinds: moves ? (["transfer", "contribution", "redemption"] as EntryKind[]) : undefined,
    status,
    accountId: values.account || undefined,
    categoryIds,
    search: values.q || undefined,
  };
  const entries = await listEntries(repos, userId, range ? { ...filters, ...range } : { ...filters, period: month });
  // Settled and planned apart, the way Review shows them, so one month never shows two different "out".
  const sumOf = (match: (e: Entry) => boolean): [number, number] => [
    entries.filter((e) => match(e) && e.status === "settled").reduce((s, e) => s + e.amountCents, 0),
    entries.filter((e) => match(e) && e.status === "planned").reduce((s, e) => s + e.amountCents, 0),
  ];
  const totals = {
    count: entries.length,
    in: sumOf((e) => e.kind === "income"),
    out: sumOf((e) => e.kind === "expense"),
    moved: sumOf((e) => isMove(e.kind)),
  };

  return (
    <>
      <PageHeader
        title="Entries"
        action={
          <Button render={<Link href="/add" />} nativeButton={false} size="lg" className="hidden h-11 md:inline-flex">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        }
      />
      <div className="mb-4">
        <EntryFilters values={values} accounts={accounts} categories={categories} range={range} />
      </div>
      {/* In, out and moved side by side, each settled with what is still planned under it, as on Review. */}
      {totals.count > 0 && (
        <div className="@container mb-4">
          <dl className="grid grid-cols-1 gap-2 text-xs tabular-nums @min-[20rem]:grid-cols-3">
            {(
              [
                ["In", totals.in],
                ["Out", totals.out],
                ["Moved", totals.moved],
              ] as const
            ).map(([label, [settled, planned]]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{formatBRL(settled)}</dd>
                {planned > 0 && <dd className="text-muted-foreground">+ {formatBRL(planned)} planned</dd>}
              </div>
            ))}
          </dl>
        </div>
      )}
      <EntryList
        key={JSON.stringify({ ...values, range })}
        meta={
          // Elements handed across the server/client boundary lose their "static child" mark: without a key React warns.
          totals.count > 0 ? (
            <p key="meta" className="min-w-0 text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {totals.count} {totals.count === 1 ? "entry" : "entries"}
              {range ? ` · ${formatDate(range.from)} → ${formatDate(range.to)}` : ""}
            </p>
          ) : undefined
        }
        initial={entries}
        period={month}
        filters={filters}
        lookups={buildLookups(accounts, categories)}
        today={now}
        infinite={range === null}
        collapseFuture={range === null && month === periodOf(now)}
        emptyMessage="No entries match. Add one or load an earlier month."
        emptyAction={
          <Button render={<Link href="/add" />} nativeButton={false} variant="outline" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            Add entry
          </Button>
        }
      />
    </>
  );
}
