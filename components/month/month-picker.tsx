"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, formatPeriodLong } from "@/lib/domain/dates";
import type { Period } from "@/lib/domain/types";

/** Prev / next arrows around a native month input; navigates via `?month=`. */
export function MonthPicker({ period, basePath }: { period: Period; basePath: string }) {
  const router = useRouter();
  const href = (p: Period) => `${basePath}?month=${p}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="icon-lg" className="size-11" aria-label="Previous month" render={<Link href={href(addMonths(period, -1))} />} nativeButton={false}>
        <ChevronLeft aria-hidden />
      </Button>
      <label className="relative flex-1 text-center">
        <span className="text-base font-semibold">{formatPeriodLong(period)}</span>
        <input
          type="month"
          value={period}
          onChange={(e) => e.target.value && router.push(href(e.target.value))}
          aria-label="Month"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Button variant="outline" size="icon-lg" className="size-11" aria-label="Next month" render={<Link href={href(addMonths(period, 1))} />} nativeButton={false}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
