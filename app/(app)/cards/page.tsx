import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { CardTile } from "@/components/cards/card-tile";
import { PayStatementDialog } from "@/components/cards/pay-statement-dialog";
import { UnpayButton } from "@/components/cards/unpay-button";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/month/stat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isCashAccount } from "@/lib/domain/accounts";
import { addDays, formatDate, formatDayMonth, formatPeriodShort, periodOf, today } from "@/lib/domain/dates";
import { formatBRL, formatBRLWrap } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import type { Account } from "@/lib/domain/types";
import { cardsOverview, type StatementView } from "@/lib/services/cards";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { cn } from "@/lib/utils";

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
        {overview.issues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>{overview.issues.length === 1 ? "One statement and its payment disagree" : `${overview.issues.length} statements and their payments disagree`}</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1">
                {overview.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <Stat label="Total card debt" cents={overview.totalDebtCents} hint="unpaid statements, all cards" />

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

        {[selected].map((card) => {
          // What the card asks of you comes first: closed statements not paid yet, the oldest on top.
          const toPay = card.past.filter((s) => s.statement.paidOn === null && s.totalCents > 0).sort((a, b) => (a.statement.dueDate < b.statement.dueDate ? -1 : 1));
          const history = card.past.filter((s) => !toPay.includes(s));
          const committed = card.debtCents + card.futureCents;
          const overLimit = card.account.creditLimitCents !== null && committed > card.account.creditLimitCents;
          return (
          <section key={card.account.id} className="space-y-6">
            <header>
              <h2 className="text-lg font-semibold">{card.account.name}</h2>
              <p className="text-xs text-muted-foreground">
                Closes day {card.account.closingDay} · due day {card.account.dueDay}
                {card.account.creditLimitCents ? (
                  <>
                    {" · "}
                    <span className={cn(overLimit && "font-medium text-negative")}>
                      {formatBRL(committed)} of {formatBRL(card.account.creditLimitCents)} limit
                    </span>
                  </>
                ) : null}
              </p>
              {card.futureParts > 0 && (
                <p className="mt-1 text-sm">
                  <Link href={`/entries?account=${card.account.id}&status=planned&from=${addDays(card.open.statement.cycleEnd, 1)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                    {formatBRL(card.futureCents)} in {card.futureParts} future installment {card.futureParts === 1 ? "part" : "parts"} →
                  </Link>
                </p>
              )}
            </header>

            {toPay.length > 0 && (
              <section aria-labelledby={`to-pay-${card.account.id}`} className="space-y-2">
                <h3 id={`to-pay-${card.account.id}`} className="text-sm font-semibold">
                  To pay
                </h3>
                <ul className="space-y-2">
                  {toPay.map((s) => (
                    <ToPayStatement key={s.statement.id} view={s} cardName={card.account.name} cashAccounts={cashAccounts} today={now} />
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Open statement" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Open statement · {formatPeriodShort(periodOf(card.open.statement.cycleEnd))}</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatBRLWrap(card.open.totalCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(card.open.statement.cycleStart)} → {formatDate(card.open.statement.cycleEnd)} · due {formatDate(card.open.statement.dueDate)} (
                    {card.open.daysToDue}d)
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Closes on {formatDate(card.open.statement.cycleEnd)}; pay it after that.</p>
              {card.open.entries.length > 0 ? (
                // The purchases are the detail of the statement, not the headline: one tap away.
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {card.open.entries.length} {card.open.entries.length === 1 ? "purchase" : "purchases"}
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="pt-2">
                    <EntryList
                      initial={card.open.entries}
                      period={periodOf(now)}
                      filters={{ accountId: card.account.id }}
                      lookups={lookups}
                      today={now}
                      infinite={false}
                      settleHint={false}
                      statementLink={false}
                      emptyMessage="No purchases in this cycle yet."
                    />
                  </div>
                </details>
              ) : (
                <p className="text-sm text-muted-foreground">No purchases in this cycle yet.</p>
              )}
            </section>

            {history.length > 0 && (
              <section aria-labelledby={`history-${card.account.id}`}>
                <h3 id={`history-${card.account.id}`} className="mb-2 text-sm font-semibold">
                  History
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  {history.map((s) => (
                    <PastStatement key={s.statement.id} view={s} cardName={card.account.name} cashAccounts={cashAccounts} today={now} />
                  ))}
                </ul>
              </section>
            )}
          </section>
          );
        })}
      </div>
    </>
  );
}

/** A closed statement waiting to be paid: amount, how late, and a Pay you can hit. */
function ToPayStatement({
  view,
  cardName,
  cashAccounts,
  today,
}: {
  view: StatementView;
  cardName: string;
  cashAccounts: Pick<Account, "id" | "name" | "type">[];
  today: string;
}) {
  const { statement } = view;
  const label = formatPeriodShort(periodOf(statement.cycleEnd));
  const overdue = view.daysToDue < 0;
  const when = overdue ? `overdue ${-view.daysToDue}d · was due ${formatDate(statement.dueDate)}` : view.daysToDue === 0 ? "due today" : `due in ${view.daysToDue}d · ${formatDate(statement.dueDate)}`;
  return (
    <li className={cn("space-y-3 rounded-xl p-3 ring-1", overdue ? "border border-negative/40 bg-negative/5 ring-transparent" : "bg-card ring-foreground/10")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-28 flex-1">
          <p className="text-sm font-medium">{label} statement</p>
          <p className={cn("text-xs", overdue ? "text-negative" : "text-muted-foreground")}>
            {when} · {view.entries.length} {view.entries.length === 1 ? "purchase" : "purchases"}
            {view.carriedCents < 0 ? ` · ${formatBRL(-view.carriedCents)} credit from earlier statements deducted` : ""}
          </p>
        </div>
        <p className="ml-auto shrink-0 text-lg font-semibold tabular-nums">{formatBRLWrap(view.totalCents)}</p>
      </div>
      <PayStatementDialog statementId={statement.id} label={`${cardName} ${label}`} totalCents={view.totalCents} cashAccounts={cashAccounts} today={today} />
    </li>
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
  cashAccounts: Pick<Account, "id" | "name" | "type">[];
  today: string;
}) {
  const { statement } = view;
  const label = formatPeriodShort(periodOf(statement.cycleEnd));
  const overdue = statement.paidOn === null && view.daysToDue < 0 && view.totalCents > 0;
  return (
    <li className="flex min-h-14 items-center gap-3 py-1.5 pr-1.5 pl-4">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {statement.paidOn ? (
            <Badge variant="secondary">paid {formatDayMonth(statement.paidOn)}</Badge>
          ) : overdue ? (
            <Badge variant="destructive">overdue</Badge>
          ) : view.totalCents > 0 ? (
            <Badge variant="outline">unpaid</Badge>
          ) : view.entries.length > 0 ? (
            <Badge variant="outline">credit</Badge>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {statement.paidOn ? "" : `due ${formatDayMonth(statement.dueDate)} · `}
          {view.entries.length} {view.entries.length === 1 ? "purchase" : "purchases"}
          {statement.paidOn === null && view.totalCents === 0 && view.entries.length > 0 ? " · nothing to pay; the credit carries forward" : ""}
          {view.carriedCents < 0 ? ` · ${formatBRL(-view.carriedCents)} credit deducted` : ""}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(view.totalCents)}</span>
      {statement.paidOn ? (
        <UnpayButton statementId={statement.id} label={`${cardName} ${label}`} compact />
      ) : (
        view.totalCents > 0 && (
          <PayStatementDialog statementId={statement.id} label={`${cardName} ${label}`} totalCents={view.totalCents} cashAccounts={cashAccounts} today={today} small />
        )
      )}
    </li>
  );
}
