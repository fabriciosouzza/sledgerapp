import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/categories/category-icon";
import { formatBRL } from "@/lib/domain/money";
import type { CategoryLine } from "@/lib/services/summary";
import { cn } from "@/lib/utils";

/** Expense per category with cap progress; red past the cap (§7 /month). Sub-categories nest under their parent with their own caps. */
export function CategoryTable({ lines, href }: { lines: CategoryLine[]; href?: (categoryId: string) => string }) {
  if (lines.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No expenses this month yet.</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {lines.map((line) => (
        <li key={line.categoryId} className="px-4 py-3">
          <Line line={line} href={href?.(line.categoryId)} />
          {line.children.length > 0 && (
            <ul className="mt-2 space-y-2 border-l border-border pl-3">
              {line.children.map((child) => (
                <li key={child.categoryId}>
                  <Line line={child} small href={href?.(child.categoryId)} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Line({ line, small = false, href }: { line: CategoryLine; small?: boolean; href?: string }) {
  const over = line.capUsage !== null && line.capUsage > 1;
  const width = line.capUsage === null ? 0 : Math.min(100, line.capUsage * 100);
  const name = (
    <span className="flex min-w-0 items-center gap-2">
      {!small && <CategoryIcon icon={line.icon} color={line.color} size="sm" />}
      <span className={cn("truncate font-medium", small ? "text-xs text-muted-foreground" : "text-sm")}>{line.name}</span>
      {href && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
    </span>
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        {href ? (
          <Link href={href} className="flex min-h-9 min-w-0 items-center rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${line.name}: see the entries`}>
            {name}
          </Link>
        ) : (
          name
        )}
        <span className={cn("shrink-0 font-semibold tabular-nums", small ? "text-xs" : "text-sm", over && "text-red-600 dark:text-red-400")}>
          {formatBRL(line.settledCents)}
        </span>
      </div>
      {(line.plannedCents > 0 || line.capCents !== null) && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{line.plannedCents > 0 ? `+ ${formatBRL(line.plannedCents)} planned` : ""}</span>
          <span>{line.capCents !== null ? `cap ${formatBRL(line.capCents)}` : ""}</span>
        </div>
      )}
      {line.capCents !== null && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round((line.capUsage ?? 0) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${line.name} cap usage`}
        >
          <div className={cn("h-full rounded-full", over ? "bg-red-500" : "bg-primary")} style={{ width: `${width}%` }} />
        </div>
      )}
    </div>
  );
}
