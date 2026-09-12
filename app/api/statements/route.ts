import { today } from "@/lib/domain/dates";
import { cardsOverview } from "@/lib/services/cards";
import { json, withUser } from "../_lib/handler";

/** GET /api/statements — every card with its open and past statements. */
export async function GET() {
  return withUser(async ({ userId, repos }) => {
    const overview = await cardsOverview(repos, userId, today());
    return json({
      totalDebtCents: overview.totalDebtCents,
      cards: overview.cards.map((c) => ({
        account: c.account,
        debtCents: c.debtCents,
        open: { ...c.open.statement, totalCents: c.open.totalCents, daysToDue: c.open.daysToDue, entries: c.open.entries.length },
        past: c.past.map((p) => ({ ...p.statement, totalCents: p.totalCents, entries: p.entries.length })),
      })),
    });
  });
}
