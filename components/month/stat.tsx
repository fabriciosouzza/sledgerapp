import { formatBRL } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/** A labelled number. `null` renders as `—`: unknown, never zero (§5.10). */
export function Stat({
  label,
  cents,
  rate,
  tone = "neutral",
  hint,
  className,
}: {
  label: string;
  cents?: number | null;
  rate?: number | null;
  tone?: "neutral" | "signed" | "positive" | "negative";
  hint?: string;
  className?: string;
}) {
  let value: string;
  let color = "";
  if (rate !== undefined) {
    value = rate === null ? "—" : `${(rate * 100).toFixed(rate * 100 >= 100 || rate * 100 <= -100 ? 0 : 1)}%`;
    if (rate !== null && tone === "signed") color = rate < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
  } else {
    value = cents === null || cents === undefined ? "—" : formatBRL(cents);
    if (cents !== null && cents !== undefined) {
      if (tone === "signed") color = cents < 0 ? "text-red-600 dark:text-red-400" : cents > 0 ? "text-emerald-600 dark:text-emerald-400" : "";
      if (tone === "positive") color = "text-emerald-600 dark:text-emerald-400";
      if (tone === "negative") color = "text-red-600 dark:text-red-400";
    }
  }
  return (
    <div className={cn("rounded-xl bg-card p-3 ring-1 ring-foreground/10", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", color)}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
