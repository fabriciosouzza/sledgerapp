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
}: {
  period: Period;
  toCreate: PreviewRow[];
  existingCount: number;
  /** Compact card styling for /month. */
  card?: boolean;
  /** Other recent months with something to apply. */
  otherPending?: { period: Period; count: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ created: number; skipped: number }>();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const nothing = toCreate.length === 0;
  const keeping = toCreate.length - skipped.size;

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
      setDone(result);
      toast.success(`Added ${result.created} ${result.created === 1 ? "entry" : "entries"} to ${formatPeriodLong(period)}`);
      router.refresh();
    });
  }

  if (card && nothing && !done && otherPending.length === 0) return null;

  return (
    <section className={cn("space-y-3 rounded-xl bg-card p-4 ring-1", card ? "ring-primary/30" : "ring-foreground/10")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {!card
              ? "Generate month"
              : done
                ? `Recurring entries added to ${formatPeriodLong(period)}`
                : `${toCreate.length} recurring ${toCreate.length === 1 ? "entry" : "entries"} not applied to ${formatPeriodLong(period)}`}
          </h2>
          {card && !done && <p className="text-xs text-muted-foreground">Check the amounts — variable ones are estimates — then add them as planned entries.</p>}
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
          Added {done.created} {done.created === 1 ? "entry" : "entries"}
          {done.skipped ? `, ${done.skipped} already existed` : ""}.
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
                  className="size-4 shrink-0 accent-primary"
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
                  <CurrencyInput id={`amount-${row.recurrenceId}`} name={`amount:${row.recurrenceId}`} defaultCents={row.amountCents} className={cn("h-11 text-right", row.kind === "income" ? "text-emerald-600 dark:text-emerald-400" : row.kind === "expense" ? "text-red-600 dark:text-red-400" : "")} />
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={pending || keeping === 0}>
            <Sparkles data-icon="inline-start" aria-hidden />
            {pending ? "Adding…" : `Add ${keeping} ${keeping === 1 ? "entry" : "entries"}`}
          </Button>
        </form>
      )}
      {otherPending.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also not applied:{" "}
          {otherPending.map((m, i) => (
            <span key={m.period}>
              {i > 0 && ", "}
              <Link href={`/review?month=${m.period}`} className="underline-offset-4 hover:underline">
                {formatPeriodLong(m.period)} · {m.count}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
