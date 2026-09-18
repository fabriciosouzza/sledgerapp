"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PickerShell } from "@/components/forms/picker-shell";
import { Button } from "@/components/ui/button";
import { addMonths, formatPeriodLong, parsePeriod, periodOf, today, toPeriodString } from "@/lib/domain/dates";
import type { Period } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * ‹ month › with the label opening a year + 3×4 month grid. Either navigates
 * to `basePath?month=` or reports the period through `onChange`.
 */
export function MonthPicker({
  period,
  basePath,
  onChange,
  compact = false,
}: {
  period: Period;
  basePath?: string;
  onChange?: (period: Period) => void;
  /** Label only, no arrows (for filter rows). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(parsePeriod(period).year);
  const current = periodOf(today());

  function go(next: Period) {
    setOpen(false);
    if (onChange) onChange(next);
    else if (basePath) router.push(`${basePath}?month=${next}`);
  }

  const grid = (
    <div className="w-72 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <span className="text-sm font-semibold tabular-nums">{year}</span>
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div role="grid" className="grid grid-cols-4 gap-1">
        {MONTHS.map((label, i) => {
          const p = toPeriodString(year, i + 1);
          const selected = p === period;
          const isNow = p === current;
          return (
            <button
              key={p}
              type="button"
              role="gridcell"
              aria-selected={selected}
              onClick={() => go(p)}
              className={cn(
                "h-11 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                isNow && !selected && "ring-1 ring-primary/60",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* Outlined, so it reads as a button and not as a caption under the grid. */}
      <Button variant="outline" className="h-11 w-full" onClick={() => go(current)} disabled={period === current}>
        This month
      </Button>
    </div>
  );

  const trigger = (
    <button
      type="button"
      aria-label={`Month: ${formatPeriodLong(period)}. Change`}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-lg px-3 text-base font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        compact ? "w-full justify-start border border-input text-sm font-medium" : "min-w-0 flex-1 text-center",
      )}
    >
      {formatPeriodLong(period)}
    </button>
  );

  if (compact) {
    return (
      <PickerShell open={open} onOpenChange={(o) => { setOpen(o); if (o) setYear(parsePeriod(period).year); }} trigger={trigger} title="Month">
        {grid}
      </PickerShell>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon-lg" className="size-[44px] shrink-0 rounded-full" aria-label="Previous month" onClick={() => go(addMonths(period, -1))}>
        <ChevronLeft aria-hidden />
      </Button>
      <PickerShell open={open} onOpenChange={(o) => { setOpen(o); if (o) setYear(parsePeriod(period).year); }} trigger={trigger} title="Month">
        {grid}
      </PickerShell>
      <Button variant="ghost" size="icon-lg" className="size-[44px] shrink-0 rounded-full" aria-label="Next month" onClick={() => go(addMonths(period, 1))}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
