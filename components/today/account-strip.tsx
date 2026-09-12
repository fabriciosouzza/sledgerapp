import Link from "next/link";
import { CardTile } from "@/components/cards/card-tile";
import { formatBRL } from "@/lib/domain/money";
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
  return (
    <Link
      href="/net-worth"
      className="block h-24 w-36 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <p className="truncate text-xs text-muted-foreground">{account.name}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{balanceCents === null ? "—" : formatBRL(balanceCents)}</p>
      <p className="text-[11px] text-muted-foreground">{balanceCents === null ? "not yet open" : "balance"}</p>
    </Link>
  );
}
