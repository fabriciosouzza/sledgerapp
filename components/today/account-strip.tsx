import Link from "next/link";
import { CardTile } from "@/components/cards/card-tile";
import { formatBRLWhole, formatBRLWrap } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import type { CardView } from "@/lib/services/cards";
import type { AccountTile } from "@/lib/services/today";

/** Cash accounts with their snapshot balance, then each card (DESIGN.md §2). */
export function AccountStrip({ accounts, cards }: { accounts: AccountTile[]; cards: CardView[] }) {
  if (accounts.length === 0 && cards.length === 0) return null;

  // Tiles with something in them first; zeros and not-yet-open accounts last, whatever their type.
  const tiles = [
    ...accounts.map((a) => ({ key: a.account.id, known: a.balanceCents !== null && a.balanceCents !== 0, node: <CashTile account={a} /> })),
    ...cards.map((c) => ({
      key: c.account.id,
      known: c.open.totalCents > 0 || c.debtCents > 0,
      node: (
        <Link href={`/cards?card=${c.account.id}`} className="block focus-visible:outline-2 focus-visible:outline-ring">
          <CardTile card={c} />
        </Link>
      ),
    })),
  ].sort((a, b) => Number(b.known) - Number(a.known));

  return (
    <div className="tile-strip">
      {tiles.map((t) => (
        <div key={t.key}>{t.node}</div>
      ))}
    </div>
  );
}

function CashTile({ account: { account, balanceCents } }: { account: AccountTile }) {
  // A savings account with a target is a goal: the tile shows the way there.
  const goal = account.targetCents !== null && balanceCents !== null ? Math.min(1, Math.max(0, balanceCents / account.targetCents)) : null;
  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex h-24 w-36 flex-col rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <p className="truncate text-xs text-muted-foreground">
        {account.name}
        {!account.isActive && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase">inactive</span>}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{balanceCents === null ? "—" : formatBRLWrap(balanceCents)}</p>
      <p className="truncate text-xs text-muted-foreground">
        {balanceCents === null ? "not yet open" : goal !== null ? `${Math.round(goal * 100)}% of ${formatBRLWhole(account.targetCents!)}` : "balance"}
      </p>
      {goal !== null && (
        <div className="mt-auto h-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(goal * 100)}% of the goal`}>
          <div className={cn("h-full rounded-full", goal >= 1 ? "bg-positive" : "bg-primary")} style={{ width: `${goal * 100}%` }} />
        </div>
      )}
    </Link>
  );
}
