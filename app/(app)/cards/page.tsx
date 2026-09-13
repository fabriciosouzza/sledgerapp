import Link from "next/link";
import { CardTile } from "@/components/cards/card-tile";
import { PayStatementDialog } from "@/components/cards/pay-statement-dialog";
import { UnpayButton } from "@/components/cards/unpay-button";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isCashAccount } from "@/lib/domain/accounts";
import { formatDate, formatPeriodShort, periodOf, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { cardsOverview, type StatementView } from "@/lib/services/cards";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";

export default async function CardsPage(props: PageProps<"/cards">) {
  const sp = await props.searchParams;
  const now = today();
  const { userId, repos } = await getContext();
  const [overview, accounts, categories] = await Promise.all([
    cardsOverview(repos, userId, now),
    listAccounts(repos, userId),
    listCategories(repos, userId),
  ]);
  const cashAccounts = accounts.filter((a) => a.isActive && isCashAccount(a));
  const lookups = buildLookups(accounts, categories);

  if (overview.cards.length === 0) {
    return (
      <>
        <PageHeader title="Cards" />
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No credit cards yet. Add one with its closing and due days.</p>
          <Button render={<Link href="/settings/accounts/new" />} nativeButton={false} className="mt-4 h-11">
            Add card
          </Button>
        </div>
      </>
    );
  }

  const selected = overview.cards.find((c) => c.account.id === sp.card) ?? overview.cards[0];

  return (
    <>
      <PageHeader title="Cards" />
      <div className="space-y-6">
        <Stat label="Total card debt" cents={overview.totalDebtCents} tone="negative" hint="unpaid statements, all cards" />

        <nav aria-label="Card" className="tile-strip">
          {overview.cards.map((card) => (
            <Link
              key={card.account.id}
              href={`/cards?card=${card.account.id}`}
              aria-current={card === selected ? "page" : undefined}
              className={`block rounded-xl transition-shadow focus-visible:outline-2 focus-visible:outline-ring ${card === selected ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
            >
              <CardTile card={card} />
            </Link>
          ))}
        </nav>

        {[selected].map((card) => (
          <section key={card.account.id} className="space-y-4">
            <header>
              <h2 className="text-lg font-semibold">{card.account.name}</h2>
              <p className="text-xs text-muted-foreground">
                Closes day {card.account.closingDay} · due day {card.account.dueDay}
                {card.account.creditLimitCents ? ` · ${formatBRL(card.debtCents)} of ${formatBRL(card.account.creditLimitCents)} limit` : ""}
              </p>
            </header>

            <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Open statement · {formatPeriodShort(periodOf(card.open.statement.cycleEnd))}</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatBRL(card.open.totalCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(card.open.statement.cycleStart)} → {formatDate(card.open.statement.cycleEnd)} · due {formatDate(card.open.statement.dueDate)} (
                    {card.open.daysToDue}d)
                  </p>
                </div>
                <Badge variant="outline">open</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Closes on {formatDate(card.open.statement.cycleEnd)}; pay it after that.</p>
              <EntryList
                initial={card.open.entries}
                period={periodOf(now)}
                filters={{ accountId: card.account.id }}
                lookups={lookups}
                today={now}
                infinite={false}
                emptyMessage="No purchases in this cycle yet."
              />
            </div>

            {card.past.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Past statements</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  {card.past.map((s) => (
                    <PastStatement key={s.statement.id} view={s} cardName={card.account.name} cashAccounts={cashAccounts} today={now} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function PastStatement({
  view,
  cardName,
  cashAccounts,
  today,
}: {
  view: StatementView;
  cardName: string;
  cashAccounts: { id: string; name: string }[];
  today: string;
}) {
  const { statement } = view;
  const label = formatPeriodShort(periodOf(statement.cycleEnd));
  const overdue = statement.paidOn === null && view.daysToDue < 0 && view.totalCents > 0;
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {statement.paidOn ? (
            <Badge variant="secondary">paid {formatDate(statement.paidOn)}</Badge>
          ) : overdue ? (
            <Badge variant="destructive">overdue</Badge>
          ) : view.totalCents > 0 ? (
            <Badge variant="outline">unpaid</Badge>
          ) : null}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatDate(statement.cycleStart)} → {formatDate(statement.cycleEnd)} · due {formatDate(statement.dueDate)} · {view.entries.length}{" "}
          {view.entries.length === 1 ? "entry" : "entries"}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(view.totalCents)}</span>
      {statement.paidOn ? (
        <UnpayButton statementId={statement.id} label={`${cardName} ${label}`} />
      ) : (
        view.totalCents > 0 && (
          <PayStatementDialog statementId={statement.id} label={`${cardName} ${label}`} totalCents={view.totalCents} cashAccounts={cashAccounts} today={today} small />
        )
      )}
    </li>
  );
}
