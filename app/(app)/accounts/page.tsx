import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accountTypeLabel } from "@/lib/domain/accounts";
import { formatDate, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { cardsOverview } from "@/lib/services/cards";
import { getContext } from "@/lib/services/context";
import { netWorthOverview } from "@/lib/services/netWorth";

/**
 * Your accounts as money: each cash account with its balance today, each
 * card with what it owes, and one tap into the entries behind it. Adding
 * and editing accounts stays in Settings.
 */
export default async function AccountsPage() {
  const now = today();
  const { userId, repos } = await getContext();
  const [netWorth, cards] = await Promise.all([netWorthOverview(repos, userId, now, 1), cardsOverview(repos, userId, now, { ensure: "open" })]);
  // An inactive account still holding money is still money.
  const cash = netWorth.balances.filter((b) => b.account.isActive || (b.balanceCents !== null && b.balanceCents !== 0));

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Balances today, from what you recorded"
        action={
          <Button variant="outline" className="h-11" render={<Link href="/settings/accounts" />} nativeButton={false}>
            <Settings2 data-icon="inline-start" aria-hidden />
            Manage
          </Button>
        }
      />
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-2">
          <Stat label="Cash on hand" cents={netWorth.cashCents} hint="all cash accounts" />
          <Stat label="Card debt" cents={cards.totalDebtCents} hint="unpaid statements" href="/cards" />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Cash</h2>
          {cash.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No cash account yet.</p>
              <Button render={<Link href="/settings/accounts/new" />} nativeButton={false} className="mt-4 h-11">
                Add account
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {cash.map(({ account, balanceCents }) => (
                <li key={account.id}>
                  <Link
                    href={`/accounts/${account.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{account.name}</span>
                        {!account.isActive && <Badge variant="outline">inactive</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {accountTypeLabel(account.type)} · from {formatDate(account.openingOn)} at {formatBRL(account.openingBalanceCents)}
                        {account.targetCents !== null && balanceCents !== null ? ` · ${Math.round((balanceCents / account.targetCents) * 100)}% of ${formatBRL(account.targetCents)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{balanceCents === null ? "—" : formatBRL(balanceCents)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {cards.cards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Cards</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {cards.cards.map((card) => (
                <li key={card.account.id}>
                  <Link
                    href={`/cards?card=${card.account.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{card.account.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Credit card · closes day {card.account.closingDay} · due day {card.account.dueDay}
                        {card.limitUsage !== null ? ` · ${Math.round(card.limitUsage * 100)}% of the limit` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(card.debtCents)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="px-1 text-xs text-muted-foreground">
          A balance is the opening balance plus every settled entry since. If the bank shows something else, an entry is missing — add it.
        </p>
      </div>
    </>
  );
}
