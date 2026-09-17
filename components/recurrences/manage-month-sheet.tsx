"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setRecurrenceMonthAction } from "@/app/(app)/review/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/responsive-sheet";
import { formatDayMonth, formatPeriodLong } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { EntryKind, Period } from "@/lib/domain/types";
import type { MonthRecurrenceState } from "@/lib/services/recurrences";
import { cn } from "@/lib/utils";

export interface MonthRow {
  recurrenceId: string;
  description: string;
  kind: EntryKind;
  /** The entry's amount when applied, the template's otherwise. */
  amountCents: number;
  templateCents: number;
  date: string;
  state: MonthRecurrenceState;
  isVariable: boolean;
  /** An applied entry already settled cannot be changed from here. */
  settled: boolean;
}

/**
 * The month's recurring entries, the way the apply card shows them —
 * a tick and this month's amount per line — kept reachable after the month
 * was applied. Ticking creates the entry with the amount typed (and forgets
 * "not this month"); unticking removes a planned entry and remembers the
 * month; changing the amount of a planned entry re-prices it. Each change
 * is saved as it happens.
 */
export function ManageMonth({ period, rows, className }: { period: Period; rows: MonthRow[]; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState<Record<string, number | null>>({});
  const [optimistic, flip] = useOptimistic(rows, (current: MonthRow[], change: { id: string; state: MonthRecurrenceState; amountCents?: number }) =>
    current.map((r) => (r.recurrenceId === change.id ? { ...r, state: change.state, amountCents: change.amountCents ?? r.amountCents } : r)),
  );
  if (rows.length === 0) return null;
  const skipped = rows.filter((r) => r.state === "skipped");
  const applied = rows.filter((r) => r.state === "applied").length;
  const summary =
    skipped.length > 0
      ? `${skipped.length} not this month (${skipped.map((r) => r.description).join(", ")})`
      : `${applied} of ${rows.length} recurring ${rows.length === 1 ? "entry" : "entries"} applied`;
  const amountOf = (row: MonthRow) => typed[row.recurrenceId] ?? row.amountCents;

  function save(row: MonthRow, include: boolean) {
    const amountCents = amountOf(row);
    if (include && amountCents <= 0) {
      toast.error("Enter an amount.");
      return;
    }
    startTransition(async () => {
      flip({ id: row.recurrenceId, state: include ? "applied" : "skipped", amountCents });
      const result = await setRecurrenceMonthAction(row.recurrenceId, period, include, include ? amountCents : null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        include
          ? row.state === "applied"
            ? `${row.description}: ${formatBRL(amountCents)} this month`
            : `${row.description} added to ${formatPeriodLong(period)} · ${formatBRL(amountCents)}`
          : `${row.description}: not this month`,
      );
      router.refresh();
    });
  }

  return (
    <>
      <p className={cn("text-xs text-muted-foreground", className)}>
        {summary} ·{" "}
        <button type="button" onClick={() => setOpen(true)} className="-my-3 inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline">
          Manage
        </button>
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Recurring entries · {formatPeriodLong(period)}</SheetTitle>
            <SheetDescription>Tick a line to have it in the month, with this month&apos;s amount; untick it and the month stops asking for it. Saved as you go.</SheetDescription>
          </SheetHeader>
          <SheetBody className="pt-2">
            <ul className="divide-y divide-border" aria-label="Recurring entries this month">
              {optimistic.map((row) => {
                const on = row.state === "applied";
                const locked = row.settled;
                return (
                  <li key={row.recurrenceId} className={cn("flex items-center gap-3 py-2", !on && "opacity-70")}>
                    <input
                      type="checkbox"
                      aria-label={`${row.description} this month`}
                      checked={on}
                      disabled={pending || locked}
                      onChange={(e) => save(row, e.target.checked)}
                      className="size-5 shrink-0 accent-primary"
                    />
                    <label htmlFor={`month-amount-${row.recurrenceId}`} className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{row.description}</span>
                        {row.isVariable && <Badge variant="outline">variable</Badge>}
                        {locked && <Badge variant="secondary">settled</Badge>}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatDayMonth(row.date)} · template {formatBRL(row.templateCents)}
                        {row.state === "skipped" ? " · not this month" : ""}
                      </span>
                    </label>
                    <div className="w-32 shrink-0">
                      {locked ? (
                        <span className="block text-right text-sm font-medium tabular-nums">{formatBRL(row.amountCents)}</span>
                      ) : (
                        <CurrencyInput
                          id={`month-amount-${row.recurrenceId}`}
                          name={`amount:${row.recurrenceId}`}
                          defaultCents={row.amountCents}
                          onCentsChange={(v) => setTyped((t) => ({ ...t, [row.recurrenceId]: v }))}
                          onBlur={() => {
                            // A planned entry follows the amount as soon as you leave the field; a line not in the month waits for its tick.
                            if (on && amountOf(row) !== row.amountCents && amountOf(row) > 0) save(row, true);
                          }}
                          className={cn("h-11 text-right", row.kind === "income" ? "text-positive" : "")}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
