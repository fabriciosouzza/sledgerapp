"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setRecurrenceMonthAction } from "@/app/(app)/review/actions";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/responsive-sheet";
import { Switch } from "@/components/ui/switch";
import { formatDayMonth, formatPeriodLong } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { Period } from "@/lib/domain/types";
import type { MonthRecurrenceState } from "@/lib/services/recurrences";

export interface MonthRow {
  recurrenceId: string;
  description: string;
  amountCents: number;
  date: string;
  state: MonthRecurrenceState;
  /** An applied entry already settled cannot be taken out from here. */
  settled: boolean;
}

/**
 * One line under the month, and the whole month inside a sheet: every
 * template that falls in it with a switch — on means its entry exists (or
 * is created now), off means "not this month" (a planned entry is removed).
 * Nothing to close and reopen: each flip is saved as it happens.
 */
export function ManageMonth({ period, rows }: { period: Period; rows: MonthRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimistic, flip] = useOptimistic(rows, (current: MonthRow[], change: { id: string; state: MonthRecurrenceState }) =>
    current.map((r) => (r.recurrenceId === change.id ? { ...r, state: change.state } : r)),
  );
  if (rows.length === 0) return null;
  const skipped = rows.filter((r) => r.state === "skipped");
  const applied = rows.filter((r) => r.state === "applied").length;
  const summary =
    skipped.length > 0
      ? `${skipped.length} not this month (${skipped.map((r) => r.description).join(", ")})`
      : `${applied} of ${rows.length} recurring ${rows.length === 1 ? "entry" : "entries"} applied`;

  function set(row: MonthRow, include: boolean) {
    startTransition(async () => {
      flip({ id: row.recurrenceId, state: include ? "applied" : "skipped" });
      const result = await setRecurrenceMonthAction(row.recurrenceId, period, include);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(include ? `${row.description} added to ${formatPeriodLong(period)}` : `${row.description}: not this month`);
      router.refresh();
    });
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {summary} ·{" "}
        <button type="button" onClick={() => setOpen(true)} className="-my-3 inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline">
          Manage
        </button>
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{formatPeriodLong(period)}: recurring entries</SheetTitle>
            <SheetDescription>On, the entry is in the month; off, the month is not asking for it. Amounts are the templates&apos; — edit the entry for this month&apos;s figure.</SheetDescription>
          </SheetHeader>
          <SheetBody className="pt-2">
            <ul className="divide-y divide-border" aria-label="Recurring entries this month">
              {optimistic.map((row) => {
                const on = row.state === "applied";
                return (
                  <li key={row.recurrenceId} className="flex min-h-14 items-center justify-between gap-3 py-1">
                    <label htmlFor={`month-${row.recurrenceId}`} className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{row.description}</span>
                        {row.settled && <Badge variant="secondary">settled</Badge>}
                        {row.state === "skipped" && <Badge variant="outline">not this month</Badge>}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatDayMonth(row.date)} · {formatBRL(row.amountCents)}
                      </span>
                    </label>
                    <Switch id={`month-${row.recurrenceId}`} checked={on} disabled={pending || row.settled} onCheckedChange={(v) => set(row, v)} aria-label={`${row.description} this month`} />
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
