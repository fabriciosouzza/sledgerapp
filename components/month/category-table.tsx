import { formatBRL } from "@/lib/domain/money";
import type { CategoryLine } from "@/lib/services/summary";
import { cn } from "@/lib/utils";

/** Expense per category with cap progress; red past the cap (§7 /month). Sub-categories nest under their parent with their own caps. */
export function CategoryTable({ lines }: { lines: CategoryLine[] }) {
  if (lines.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No expenses this month yet.</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {lines.map((line) => (
        <li key={line.categoryId} className="px-4 py-3">
          <Line line={line} />
          {line.children.length > 0 && (
            <ul className="mt-2 space-y-2 border-l border-border pl-3">
              {line.children.map((child) => (
                <li key={child.categoryId}>
                  <Line line={child} small />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Line({ line, small = false }: { line: CategoryLine; small?: boolean }) {
  const over = line.capUsage !== null && line.capUsage > 1;
  const width = line.capUsage === null ? 0 : Math.min(100, line.capUsage * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("truncate font-medium", small ? "text-xs text-muted-foreground" : "text-sm")}>{line.name}</span>
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
