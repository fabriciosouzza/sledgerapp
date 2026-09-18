import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatBRLWrap, formatPercent } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/** A labelled number. `null` renders as `—`: unknown, never zero (§5.10). */
export function Stat({
  label,
  cents,
  rate,
  text,
  tone = "neutral",
  hint,
  className,
  href,
}: {
  label: string;
  cents?: number | null;
  rate?: number | null;
  /** Preformatted text, when neither cents nor a rate fits. */
  text?: string | null;
  /** "signed": green above zero, red below (§8). "negative" / "caution" / "positive" colour the value whatever it reads, for a verdict the caller already knows ("2 caps over"). Otherwise plain: the label already says which way the money goes. */
  tone?: "neutral" | "signed" | "positive" | "negative" | "caution";
  hint?: string;
  className?: string;
  /** Makes the tile a link to the rows behind the number. */
  href?: string;
}) {
  let value: string;
  let color = tone === "negative" ? "text-negative" : tone === "caution" ? "text-caution" : tone === "positive" ? "text-positive" : "";
  if (text !== undefined) {
    value = text ?? "—";
  } else if (rate !== undefined) {
    value = rate === null ? "—" : formatPercent(rate);
    if (rate !== null && tone === "signed") color = rate < 0 ? "text-negative" : rate > 0 ? "text-positive" : "";
  } else {
    value = cents === null || cents === undefined ? "—" : formatBRLWrap(cents);
    if (cents !== null && cents !== undefined) {
      if (tone === "signed") color = cents < 0 ? "text-negative" : cents > 0 ? "text-positive" : "";
    }
  }
  const body = (
    <>
      <p className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
        {/* Long labels ("Savings rate ex-benefits") wrap rather than lose their end. */}
        <span className="min-w-0">{label}</span>
        {href && <ChevronRight className="mt-px size-3.5 shrink-0" aria-hidden />}
      </p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", color)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cn("block rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring", className)}>
        {body}
      </Link>
    );
  }
  return <div className={cn("rounded-xl bg-card p-3 ring-1 ring-foreground/10", className)}>{body}</div>;
}
