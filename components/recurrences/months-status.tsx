import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { formatPeriodLong } from "@/lib/domain/dates";
import type { Period } from "@/lib/domain/types";

export interface MonthStatus {
  period: Period;
  applied: number;
  pending: number;
}

/** Where each upcoming month stands; applying happens on Review (DESIGN.md). */
export function MonthsStatus({ months }: { months: MonthStatus[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {months.map((m) => {
        const total = m.applied + m.pending;
        const done = m.pending === 0;
        return (
          <li key={m.period}>
            <Link
              href={`/review?month=${m.period}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{formatPeriodLong(m.period)}</span>
                <span className="block text-xs text-muted-foreground">
                  {total === 0 ? "no recurrences apply" : done ? `${m.applied} of ${total} applied` : `${m.pending} of ${total} still to apply`}
                </span>
              </span>
              {done ? (
                <Check className="size-4 text-positive" aria-label="All applied" />
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  Apply in Review <ArrowRight className="size-3" aria-hidden />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
