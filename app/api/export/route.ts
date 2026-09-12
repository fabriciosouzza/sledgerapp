import { periodOf, today } from "@/lib/domain/dates";
import { withUser } from "../_lib/handler";

/**
 * GET /api/export — everything the user owns, as one JSON document. Entries
 * are fetched a year at a time from the earliest account to keep each query bounded (§4.5).
 */
export async function GET() {
  return withUser(async ({ userId, repos }) => {
    const [accounts, categories, recurrences, assets, movements, statements] = await Promise.all([
      repos.accounts.list(userId),
      repos.categories.list(userId),
      repos.recurrences.list(userId),
      repos.assets.list(userId),
      repos.movements.list(userId),
      repos.statements.listByUser(userId),
    ]);
    const thisYear = Number(today().slice(0, 4));
    const firstYear = accounts.reduce((min, a) => Math.min(min, Number(a.openingOn.slice(0, 4))), thisYear) - 1;
    const entries = [];
    for (let year = firstYear; year <= thisYear + 3; year++) {
      entries.push(...(await repos.entries.list(userId, { from: `${year}-01-01`, to: `${year}-12-31` })));
    }
    const body = { exportedOn: today(), period: periodOf(today()), accounts, categories, recurrences, entries, statements, assets, movements };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="sledger-${today()}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
