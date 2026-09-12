import { type NextRequest } from "next/server";
import { isPeriod, periodOf, today } from "@/lib/domain/dates";
import { monthSummary } from "@/lib/services/summary";
import { json, withUser } from "../_lib/handler";

/** GET /api/summary?period=2026-11 */
export async function GET(request: NextRequest) {
  return withUser(async ({ userId, repos }) => {
    const period = request.nextUrl.searchParams.get("period") ?? periodOf(today());
    if (!isPeriod(period)) return json({ error: "period must look like 2026-11." }, 400);
    const summary = await monthSummary(repos, userId, period);
    return json({ period, metrics: summary.metrics, categories: summary.categories, planned: summary.planned });
  });
}
