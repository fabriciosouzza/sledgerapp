import Link from "next/link";
import { CardTile } from "@/components/cards/card-tile";
import { formatBRL } from "@/lib/domain/money";
import type { CardView } from "@/lib/services/cards";
import type { AccountTile } from "@/lib/services/today";

/** Cash accounts with their snapshot balance, then each card (DESIGN.md §2). */
export function AccountStrip({ accounts, cards, period }: { accounts: AccountTile[]; cards: CardView[]; period: string }) {
  if (accounts.length === 0 && cards.length === 0) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0">
      {accounts.map(({ account, balanceCents }) => (
        <Link
          key={account.id}
          href={`/net-worth?month=${period}`}
          className="w-36 shrink-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <p className="truncate text-xs text-muted-foreground">{account.name}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{balanceCents === null ? "—" : formatBRL(balanceCents)}</p>
          <p className="text-[11px] text-muted-foreground">{balanceCents === null ? "no snapshot" : "snapshot"}</p>
        </Link>
      ))}
      {cards.map((card) => (
        <Link key={card.account.id} href="/cards" className="w-40 shrink-0 focus-visible:outline-2 focus-visible:outline-ring">
          <CardTile card={card} />
        </Link>
      ))}
    </div>
  );
}
