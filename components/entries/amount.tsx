import { displaySign } from "@/lib/domain/entries";
import { formatBRL } from "@/lib/domain/money";
import type { EntryKind } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Red for expense, green for income, plain for moves between accounts (§8). */
export function Amount({ kind, cents, className }: { kind: EntryKind; cents: number; className?: string }) {
  const sign = displaySign(kind);
  return (
    <span
      className={cn(
        "tabular-nums",
        sign === "-" && "text-red-600 dark:text-red-400",
        sign === "+" && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {sign}
      {formatBRL(cents)}
    </span>
  );
}
