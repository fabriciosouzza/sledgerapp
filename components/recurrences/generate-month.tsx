"use client";

import { useActionState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { generateMonthAction, type GenerateState } from "@/app/(app)/recurrences/actions";
import { Amount } from "@/components/entries/amount";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/month/month-picker";
import { formatDate, formatPeriodLong } from "@/lib/domain/dates";
import type { EntryKind, IsoDate, Period } from "@/lib/domain/types";

export interface PreviewRow {
  description: string;
  kind: EntryKind;
  amountCents: number;
  date: IsoDate;
}

/** Period picker, preview of what a run creates, and the idempotent "generate" button (§7 /recurrences). */
export function GenerateMonth({ period, toCreate, existingCount }: { period: Period; toCreate: PreviewRow[]; existingCount: number }) {
  const [state, dispatch, pending] = useActionState<GenerateState, FormData>(generateMonthAction, {});
  const done = state.created !== undefined;
  const nothing = toCreate.length === 0;

  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">Generate month</h2>
      <MonthPicker period={period} basePath="/recurrences" />

      {existingCount > 0 && (
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {formatPeriodLong(period)} already has {existingCount} generated {existingCount === 1 ? "entry" : "entries"}. Running again only adds what is missing.
          </AlertDescription>
        </Alert>
      )}

      {done ? (
        <p className="text-sm" aria-live="polite">
          Created {state.created} {state.created === 1 ? "entry" : "entries"}
          {state.skipped ? `, ${state.skipped} already existed` : ""}.
        </p>
      ) : nothing ? (
        <p className="text-sm text-muted-foreground">Nothing to create for {formatPeriodLong(period)}.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {toCreate.map((row, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.description}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(row.date)}</span>
              </span>
              <Amount kind={row.kind} cents={row.amountCents} className="shrink-0 font-semibold" />
            </li>
          ))}
        </ul>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <form action={dispatch}>
        <input type="hidden" name="period" value={period} />
        <Button type="submit" className="h-11 w-full" disabled={pending || nothing || done}>
          <Sparkles data-icon="inline-start" aria-hidden />
          {pending ? "Generating…" : done ? "Done" : `Generate ${toCreate.length} ${toCreate.length === 1 ? "entry" : "entries"}`}
        </Button>
      </form>
    </section>
  );
}
