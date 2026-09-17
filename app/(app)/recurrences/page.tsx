import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Amount } from "@/components/entries/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { MonthsStatus } from "@/components/recurrences/months-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addMonths, formatDate, periodOf, today } from "@/lib/domain/dates";
import { monthlyFixedCost } from "@/lib/domain/recurrences";
import { formatBRL } from "@/lib/domain/money";
import { getContext } from "@/lib/services/context";
import { listRecurrences, pendingMonths, previewGeneration } from "@/lib/services/recurrences";

/** How far back the "not applied" section looks. */
const EARLIER_MONTHS = 6;

export default async function RecurrencesPage() {
  const current = periodOf(today());
  const { userId, repos } = await getContext();
  const [recurrences, pending, ...previews] = await Promise.all([
    listRecurrences(repos, userId),
    pendingMonths(repos, userId, today(), EARLIER_MONTHS),
    previewGeneration(repos, userId, current),
    previewGeneration(repos, userId, addMonths(current, 1)),
  ]);
  const months = previews.map((p) => ({ period: p.period, applied: p.existing.length, pending: p.toCreate.length, skipped: p.skipped.length }));
  // Earlier months with something still to apply — a forgotten month, or a template recorded by hand.
  const earlier = pending.filter((m) => m.period !== current).map((m) => ({ period: m.period, applied: m.applied, pending: m.count }));
  const fixed = monthlyFixedCost(recurrences);
  const active = recurrences.filter((r) => r.isActive);
  const inactive = recurrences.filter((r) => !r.isActive);

  return (
    <>
      <PageHeader
        title="Recurrences"
        action={
          <Button render={<Link href="/recurrences/new" />} nativeButton={false} size="lg" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            New recurrence
          </Button>
        }
      />
      <div className="space-y-6">
        <Stat label="Monthly fixed cost" cents={fixed} hint="All active expense recurrences — what sizes the emergency fund" />

        <section>
          <h2 className="mb-2 text-sm font-semibold">This month and next</h2>
          <MonthsStatus months={months} />
        </section>

        {earlier.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-semibold">Earlier months not applied</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Last {EARLIER_MONTHS} months. A month you forgot — or a template you recorded by hand that month; untick those lines in Review and the month stops asking.
            </p>
            <MonthsStatus months={earlier} />
          </section>
        )}

        {recurrences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">No recurrences yet. Rent, subscriptions, salary: add what repeats every month.</p>
            <Button render={<Link href="/recurrences/new" />} nativeButton={false} className="mt-4 h-11">
              Add recurrence
            </Button>
          </div>
        ) : (
          <>
            <RecurrenceList title="Active" items={active} />
            {inactive.length > 0 && <RecurrenceList title="Inactive" items={inactive} />}
          </>
        )}
      </div>
    </>
  );
}

function RecurrenceList({ title, items }: { title: string; items: Awaited<ReturnType<typeof listRecurrences>> }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/recurrences/${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.description}</span>
                  {r.isVariable && <Badge variant="outline">variable</Badge>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  Day {r.dueDay} · from {formatDate(r.startsOn)}
                  {r.endsOn ? ` to ${formatDate(r.endsOn)}` : ""}
                </span>
              </span>
              <Amount kind={r.kind} cents={r.amountCents} className="shrink-0 text-sm font-semibold" />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {title === "Active" && (
        <p className="mt-1 px-1 text-xs text-muted-foreground">
          {formatBRL(items.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amountCents, 0))} in expenses every month.
        </p>
      )}
    </section>
  );
}
