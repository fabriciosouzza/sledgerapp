"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateMonthWithAmountsAction } from "@/app/(app)/review/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayMonth, formatPeriodLong } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { EntryKind, IsoDate, Period } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface PreviewRow {
  recurrenceId: string;
  description: string;
  kind: EntryKind;
  amountCents: number;
  date: IsoDate;
  isVariable: boolean;
}

/**
 * What "generate month" would create, with this month's amounts editable
 * before they exist (a variable bill keeps its estimate on the template).
 * Sits on /review as a card and on /recurrences (DESIGN.md).
 */
export function GenerateMonth({
  period,
  toCreate,
  existingCount,
  card = false,
  otherPending = [],
  manage,
}: {
  period: Period;
  toCreate: PreviewRow[];
  existingCount: number;
  /** Compact card styling for /month. */
  card?: boolean;
  /** Other recent months with something to apply. */
  otherPending?: { period: Period; count: number }[];
  /** The month's one-line summary with its management sheet; shown under the card, or alone when there is nothing to apply. */
  manage?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ created: number; skipped: number; notThisMonth: number }>();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const nothing = toCreate.length === 0;
  const keeping = toCreate.length - skipped.size;
  // Applying with lines unticked records "not this month" for them; with nothing ticked that is all it does.
  const submitLabel = keeping === 0 ? `Skip ${skipped.size} this month` : skipped.size > 0 ? `Add ${keeping} ${keeping === 1 ? "entry" : "entries"} · skip ${skipped.size}` : `Add ${keeping} ${keeping === 1 ? "entry" : "entries"}`;

  function toggle(id: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await generateMonthWithAmountsAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ ...result, notThisMonth: skipped.size });
      toast.success(
        result.created === 0
          ? `${skipped.size} ${skipped.size === 1 ? "line" : "lines"} not this month`
          : `Added ${result.created} ${result.created === 1 ? "entry" : "entries"} to ${formatPeriodLong(period)}${skipped.size > 0 ? ` · ${skipped.size} not this month` : ""}`,
      );
      router.refresh();
    });
  }

  // Nothing to apply: no card, just the month's line (and other months still waiting).
  if (card && nothing && !done) {
    if (!manage && otherPending.length === 0) return null;
    return (
      <div className="space-y-1 px-1">
        {manage}
        {otherPending.length > 0 && <OtherPending months={otherPending} />}
      </div>
    );
  }

  return (
    <section className={cn("space-y-3 rounded-xl bg-card p-4 ring-1", card ? "ring-primary/30" : "ring-foreground/10")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {!card
              ? "Generate month"
              : done
                ? `Recurring entries added to ${formatPeriodLong(period)}`
                : nothing
                  ? `Nothing left to apply to ${formatPeriodLong(period)}`
                  : `${toCreate.length} recurring ${toCreate.length === 1 ? "entry" : "entries"} not applied to ${formatPeriodLong(period)}`}
          </h2>
          {card && !done && !nothing && (
            <p className="text-xs text-muted-foreground">Check the amounts — variable ones are estimates — then add them as planned entries. Untick a line and this month stops asking for it.</p>
          )}
        </div>
      </div>

      {!card && existingCount > 0 && (
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {formatPeriodLong(period)} already has {existingCount} generated {existingCount === 1 ? "entry" : "entries"}. Running again only adds what is missing.
          </AlertDescription>
        </Alert>
      )}

      {done ? (
        <p className="text-sm" aria-live="polite">
          {done.created > 0 || done.notThisMonth === 0 ? `Added ${done.created} ${done.created === 1 ? "entry" : "entries"}` : "Nothing added"}
          {done.skipped ? `, ${done.skipped} already existed` : ""}
          {done.notThisMonth ? `, ${done.notThisMonth} not this month` : ""}.
        </p>
      ) : nothing ? (
        <p className="text-sm text-muted-foreground">Nothing to create for {formatPeriodLong(period)}.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="period" value={period} />
          <ul className="divide-y divide-border text-sm">
            {toCreate.map((row) => (
              <li key={row.recurrenceId} className={cn("flex items-center justify-between gap-3 py-2", skipped.has(row.recurrenceId) && "opacity-50")}>
                <input
                  type="checkbox"
                  aria-label={`Include ${row.description}`}
                  checked={!skipped.has(row.recurrenceId)}
                  onChange={() => toggle(row.recurrenceId)}
                  className="size-5 shrink-0 accent-primary"
                />
                {skipped.has(row.recurrenceId) && <input type="hidden" name={`skip:${row.recurrenceId}`} value="1" />}
                <label htmlFor={`amount-${row.recurrenceId}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{row.description}</span>
                    {row.isVariable && <Badge variant="outline">variable</Badge>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDayMonth(row.date)} · template {formatBRL(row.amountCents)}
                  </span>
                </label>
                <div className="w-32 shrink-0">
                  <CurrencyInput id={`amount-${row.recurrenceId}`} name={`amount:${row.recurrenceId}`} defaultCents={row.amountCents} className={cn("h-11 text-right", row.kind === "income" ? "text-positive" : "")} />
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-11 w-full" variant={keeping === 0 ? "outline" : "default"} disabled={pending || (keeping === 0 && skipped.size === 0)}>
            <Sparkles data-icon="inline-start" aria-hidden />
            {pending ? "Saving…" : submitLabel}
          </Button>
        </form>
      )}
      {manage}
      {otherPending.length > 0 && <OtherPending months={otherPending} />}
    </section>
  );
}

function OtherPending({ months }: { months: { period: Period; count: number }[] }) {
  return (
    <p className="text-xs text-muted-foreground">
      Also not applied:{" "}
      {months.map((m, i) => (
        <span key={m.period}>
          {i > 0 && ", "}
          <Link href={`/review?month=${m.period}`} className="underline-offset-4 hover:underline">
            {formatPeriodLong(m.period)} · {m.count}
          </Link>
        </span>
      ))}
    </p>
  );
}
