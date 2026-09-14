import { formatDayMonth } from "@/lib/domain/dates";
import { formatBRLWrap } from "@/lib/domain/money";
import type { CardView } from "@/lib/services/cards";
import { cn } from "@/lib/utils";

/** One tile per card: open statement total and days to due (§7 Today, /cards). */
/**
 * What matters first: a closed statement waiting to be paid (red when
 * overdue); otherwise the open cycle and when it closes. The bar is the
 * share of the credit limit in use.
 */
export function CardTile({ card, className }: { card: CardView; className?: string }) {
  const toPay = card.past.filter((s) => s.statement.paidOn === null && s.totalCents > 0).sort((a, b) => a.daysToDue - b.daysToDue)[0];
  const usage = card.limitUsage;
  return (
    <div className={cn("flex h-24 w-36 flex-col overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10", className)}>
      <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{card.account.name}</span>
        {usage !== null && (
          <span className={cn("shrink-0 tabular-nums", usage > 0.9 && "text-negative")} title={`${Math.round(usage * 100)}% of the limit in use, future installments included`}>
            {Math.round(usage * 100)}% limit
          </span>
        )}
      </p>
      {toPay ? (
        <>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatBRLWrap(toPay.totalCents)}</p>
          <p className={cn("truncate text-xs whitespace-nowrap", toPay.daysToDue < 0 ? "text-negative" : "text-muted-foreground")}>
            {toPay.daysToDue < 0 ? `overdue · due ${formatDayMonth(toPay.statement.dueDate)}` : toPay.daysToDue === 0 ? "due today" : `due in ${toPay.daysToDue}d · ${formatDayMonth(toPay.statement.dueDate)}`}
          </p>
        </>
      ) : (
        <>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatBRLWrap(card.open.totalCents)}</p>
          <p className="truncate text-xs whitespace-nowrap text-muted-foreground">so far · closes {formatDayMonth(card.open.statement.cycleEnd)}</p>
        </>
      )}
      {usage !== null && (
        <div className="mt-auto h-1 overflow-hidden rounded-full bg-muted" aria-label={`${Math.round(usage * 100)}% of the credit limit in use, future installments included`} role="img">
          <div className={cn("h-full rounded-full", usage > 0.9 ? "bg-negative" : "bg-primary")} style={{ width: `${Math.min(100, usage * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
