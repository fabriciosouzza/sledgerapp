import { displaySign } from "@/lib/domain/entries";
import { formatBRL } from "@/lib/domain/money";
import type { EntryKind } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Plain for money out, with a true minus; green only for money in. In a list of expenses the sign carries no news (§8, DESIGN.md 2026-09-14). */
export function Amount({ kind, cents, className }: { kind: EntryKind; cents: number; className?: string }) {
  const sign = displaySign(kind);
  return (
    <span
      className={cn(
        "tabular-nums",
        sign === "+" && "text-positive",
        className,
      )}
    >
      {sign === "-" ? "−" : sign}
      {formatBRL(cents)}
    </span>
  );
}
