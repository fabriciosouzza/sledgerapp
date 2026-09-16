import { type NextRequest } from "next/server";
import { isPeriod, periodOf, today } from "@/lib/domain/dates";
import type { EntryKind } from "@/lib/domain/types";
import { entryInputSchema, entryKindSchema } from "@/lib/schemas/entries";
import { createEntry, listEntries } from "@/lib/services/entries";
import { json, parseBody, withUser } from "../_lib/handler";

/** GET /api/entries?period=2026-11[&status=planned&kind=expense&account=…&category=…&q=…] */
export async function GET(request: NextRequest) {
  return withUser(async ({ userId, repos }) => {
    const sp = request.nextUrl.searchParams;
    const period = sp.get("period") ?? periodOf(today());
    if (!isPeriod(period)) return json({ error: "period must look like 2026-11." }, 400);
    const status = sp.get("status");
    const kind = sp.get("kind");
    const entries = await listEntries(repos, userId, {
      period,
      status: status === "planned" || status === "settled" ? status : undefined,
      kind: entryKindSchema.safeParse(kind).success ? (kind as EntryKind) : undefined,
      accountId: sp.get("account") ?? undefined,
      categoryId: sp.get("category") ?? undefined,
      search: sp.get("q") ?? undefined,
    });
    return json({ period, entries });
  });
}

/** POST /api/entries — same shape as the /add form, JSON. */
export async function POST(request: Request) {
  return withUser(async ({ userId, repos }) => {
    const body = await parseBody(request, entryInputSchema);
    if ("response" in body) return body.response;
    const result = await createEntry(repos, userId, body.data, { today: today() });
    return json(result, 201);
  });
}
