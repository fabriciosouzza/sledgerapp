import type { NextRequest } from "next/server";
import { isPeriod, periodOf, today } from "@/lib/domain/dates";
import type { Account } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { withUser } from "../_lib/handler";
import { entriesCsv } from "./csv";

/** Every entry, a year at a time from the earliest account (each query stays bounded, §4.5). */
async function allEntries(repos: Repositories, userId: string, accounts: Account[]) {
  const thisYear = Number(today().slice(0, 4));
  const firstYear = accounts.reduce((min, a) => Math.min(min, Number(a.openingOn.slice(0, 4))), thisYear) - 1;
  const entries = [];
  for (let year = firstYear; year <= thisYear + 3; year++) {
    entries.push(...(await repos.entries.list(userId, { from: `${year}-01-01`, to: `${year}-12-31` })));
  }
  return entries;
}

/**
 * GET /api/export — everything the user owns, as one JSON document. Entries
 * are fetched a year at a time from the earliest account to keep each query bounded (§4.5).
 */
export async function GET(request: NextRequest) {
  return withUser(async ({ userId, repos }) => {
    const sp = request.nextUrl.searchParams;
    // ?format=csv[&period=2026-09]: one month (or everything) as a spreadsheet-ready file.
    if (sp.get("format") === "csv") {
      const period = sp.get("period");
      if (period !== null && !isPeriod(period)) return Response.json({ error: "period must look like 2026-11." }, { status: 400 });
      const [accounts, categories] = await Promise.all([repos.accounts.list(userId), repos.categories.list(userId)]);
      const entries = period ? await repos.entries.list(userId, { period }) : await allEntries(repos, userId, accounts);
      return new Response(entriesCsv(entries, accounts, categories), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="sledger-${period ?? "all"}.csv"`,
          "cache-control": "no-store",
        },
      });
    }
    const [accounts, categories, recurrences, assets, movements, statements] = await Promise.all([
      repos.accounts.list(userId),
      repos.categories.list(userId),
      repos.recurrences.list(userId),
      repos.assets.list(userId),
      repos.movements.list(userId),
      repos.statements.listByUser(userId),
    ]);
    const entries = await allEntries(repos, userId, accounts);
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
