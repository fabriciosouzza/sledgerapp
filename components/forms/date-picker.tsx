"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { PickerShell } from "@/components/forms/picker-shell";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { formatDate, parseIsoDate, today, toIsoDate } from "@/lib/domain/dates";
import type { IsoDate } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

function toDate(iso: IsoDate): Date {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(year, month - 1, day);
}

function fromDate(date: Date): IsoDate {
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Calendar in a popover (desktop) or a sheet (mobile). The value travels as an
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
        <div className="space-y-1">
          <Calendar
            mode="single"
            selected={iso ? toDate(iso) : undefined}
            defaultMonth={iso ? toDate(iso) : undefined}
            onSelect={(date) => date && set(fromDate(date))}
            captionLayout="dropdown"
            className="[--cell-size:--spacing(10)] md:[--cell-size:--spacing(8)]"
          />
          <div className="flex gap-1">
            <Button variant="ghost" className="h-11 flex-1 md:h-8" onClick={() => set(today())}>
              Today
            </Button>
            {clearable && (
              <Button variant="ghost" className="h-11 flex-1 md:h-8" onClick={() => set(null)} disabled={!iso}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </PickerShell>
    </>
  );
}
