import { formatDate } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { CardView } from "@/lib/services/cards";
import { cn } from "@/lib/utils";

/** One tile per card: open statement total and days to due (§7 Today, /cards). */
export function CardTile({ card, className }: { card: CardView; className?: string }) {
  const { open } = card;
  const due = open.daysToDue;
  return (
    <div className={cn("flex h-24 w-36 flex-col overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10", className)}>
      <p className="truncate text-xs text-muted-foreground">{card.account.name}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatBRL(open.totalCents)}</p>
      <p className={cn("truncate text-[11px] whitespace-nowrap text-muted-foreground", due < 0 && open.statement.paidOn === null && "text-red-600 dark:text-red-400")}>
        {open.statement.paidOn
          ? `paid ${formatDate(open.statement.paidOn)}`
          : `${due < 0 ? `due ${-due}d ago` : due === 0 ? "due today" : `due in ${due}d`} · ${formatDate(open.statement.dueDate)}`}
      </p>
      {card.limitUsage !== null && (
        <div className="mt-auto h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full rounded-full", card.limitUsage > 0.9 ? "bg-red-500" : "bg-primary")} style={{ width: `${Math.min(100, card.limitUsage * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
