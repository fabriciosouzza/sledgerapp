"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PickerShell } from "@/components/forms/picker-shell";
import { Button } from "@/components/ui/button";
import { addMonths, daysInMonth, formatDate, formatPeriodLong, parseIsoDate, parsePeriod, periodOf, today, toIsoDate } from "@/lib/domain/dates";
import type { IsoDate, Period } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** The month's days in a Sunday-first grid, padded with the neighbouring months' days so every row has seven. */
function gridOf(period: Period): { date: IsoDate; inside: boolean }[] {
  const { year, month } = parsePeriod(period);
  const first = new Date(year, month - 1, 1).getDay();
  const count = daysInMonth(year, month);
  const cells: { date: IsoDate; inside: boolean }[] = [];
  for (let i = -first; i < count + ((7 - ((first + count) % 7)) % 7); i++) {
    const d = new Date(year, month - 1, 1 + i);
    cells.push({ date: toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()), inside: i >= 0 && i < count });
  }
  return cells;
}

/**
 * ‹ month › over a 7-column day grid, in the month picker's idiom (DESIGN.md
 * 2026-09-18): big cells, the selected day filled, today ringed, "Today"
 * underneath. Each day carries `data-day="dd/MM/yyyy"`.
 */
function DayGrid({ value, onPick, clearable }: { value: IsoDate | null; onPick: (iso: IsoDate | null) => void; clearable: boolean }) {
  const now = today();
  const [view, setView] = useState<Period>(periodOf(value ?? now));
  return (
    <div className="w-80 max-w-full space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-lg" className="size-11 rounded-full" aria-label="Previous month" onClick={() => setView((p) => addMonths(p, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <span className="text-sm font-semibold" aria-live="polite">
          {formatPeriodLong(view)}
        </span>
        <Button variant="ghost" size="icon-lg" className="size-11 rounded-full" aria-label="Next month" onClick={() => setView((p) => addMonths(p, 1))}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="h-6 leading-6">
            {d}
          </span>
        ))}
      </div>
      <div role="grid" aria-label={formatPeriodLong(view)} className="grid grid-cols-7 gap-1">
        {gridOf(view).map(({ date, inside }) => {
          const selected = date === value;
          const isToday = date === now;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={formatDate(date)}
              data-day={formatDate(date)}
              onClick={() => onPick(date)}
              className={cn(
                "h-11 rounded-lg text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                !inside && !selected && "text-muted-foreground/60",
                isToday && !selected && "ring-1 ring-primary/60",
              )}
            >
              {parseIsoDate(date).day}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" className="h-11 flex-1" onClick={() => onPick(now)} disabled={value === now}>
          Today
        </Button>
        {clearable && (
          <Button variant="ghost" className="h-11 flex-1" onClick={() => onPick(null)} disabled={!value}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A day in a popover (desktop) or a sheet (mobile). The value travels as an
 * ISO date in a hidden input, so the schemas see exactly what `<input type="date">` sent.
 */
export function DatePicker({
  name,
  id,
  value,
  defaultValue,
  onChange,
  required,
  clearable = false,
  placeholder = "Pick a date",
  className,
}: {
  name: string;
  id?: string;
  /** Controlled ISO value. */
  value?: IsoDate | null;
  defaultValue?: IsoDate | null;
  onChange?: (iso: IsoDate | null) => void;
  required?: boolean;
  /** Offer "Clear" (optional dates such as a recurrence's end). */
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState<IsoDate | null>(defaultValue ?? null);
  const iso = value !== undefined ? value : inner;

  function set(next: IsoDate | null) {
    setInner(next);
    onChange?.(next);
    setOpen(false);
  }

  const trigger = (
    <button
      type="button"
      id={id}
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring md:text-sm dark:bg-input/30",
        !iso && "text-muted-foreground",
        className,
      )}
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate tabular-nums">{iso ? formatDate(iso) : placeholder}</span>
    </button>
  );

  return (
    <>
      <input type="hidden" name={name} value={iso ?? ""} required={required} />
      <PickerShell open={open} onOpenChange={setOpen} trigger={trigger} title="Date">
        {/* The shell mounts the body on open, so the grid always starts on the chosen day's month. */}
        <DayGrid value={iso} onPick={set} clearable={clearable} />
      </PickerShell>
    </>
  );
}
