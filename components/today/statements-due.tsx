import { PayStatementDialog } from "@/components/cards/pay-statement-dialog";
import { formatDate, formatPeriodShort, periodOf } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { Account } from "@/lib/domain/types";
import type { StatementDue } from "@/lib/services/cards";
import { cn } from "@/lib/utils";

/** Card statements that closed and were not paid: the bills a card actually produces. */
export function StatementsDue({
  items,
  cashAccounts,
  today,
}: {
  items: StatementDue[];
  cashAccounts: (Pick<Account, "id" | "name"> & { balanceCents?: number | null })[];
  today: string;
}) {
  if (items.length === 0) return null;
  const overdue = items.filter((s) => s.daysToDue < 0).length;
  return (
    <section aria-label="Card statements" className={cn("rounded-xl p-3 ring-1", overdue > 0 ? "border border-red-500/40 bg-red-500/5 ring-transparent" : "bg-card ring-foreground/10")}>
      <h2 className={cn("mb-2 text-sm font-semibold", overdue > 0 && "text-red-600 dark:text-red-400")}>
        Card statements to pay · {items.length}
        {overdue > 0 ? ` · ${overdue} overdue` : ""}
      </h2>
      <ul className="divide-y divide-border">
        {items.map(({ card, view, daysToDue }) => (
          <li key={view.statement.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {card.name} · {formatPeriodShort(periodOf(view.statement.cycleEnd))}
              </span>
              <span className={cn("block text-xs text-muted-foreground", daysToDue < 0 && "text-red-600 dark:text-red-400")}>
                {daysToDue < 0 ? `overdue ${-daysToDue}d · was due ${formatDate(view.statement.dueDate)}` : daysToDue === 0 ? "due today" : `due in ${daysToDue}d · ${formatDate(view.statement.dueDate)}`}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(view.totalCents)}</span>
            <PayStatementDialog
              statementId={view.statement.id}
              label={`${card.name} ${formatPeriodShort(periodOf(view.statement.cycleEnd))}`}
              totalCents={view.totalCents}
              cashAccounts={cashAccounts}
              today={today}
              small
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
