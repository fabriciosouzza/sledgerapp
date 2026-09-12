import { z } from "zod";
import { today } from "@/lib/domain/dates";
import { optionalIsoDate } from "@/lib/schemas/entries";
import { settleEntry, unsettleEntry } from "@/lib/services/entries";
import { json, parseBody, withUser } from "../../../_lib/handler";

const bodySchema = z.object({
  /** `false` reverts the settle. */
  settled: z.boolean().default(true),
  settledOn: optionalIsoDate,
});

/** PATCH /api/entries/:id/settle  { settledOn?: "2026-11-05", settled?: false } */
export async function PATCH(request: Request, ctx: RouteContext<"/api/entries/[id]/settle">) {
  const { id } = await ctx.params;
  return withUser(async ({ userId, repos }) => {
    const raw = request.headers.get("content-length") === "0" || request.headers.get("content-type") === null ? { data: bodySchema.parse({}) } : await parseBody(request, bodySchema);
    if ("response" in raw) return raw.response;
    const entry = raw.data.settled ? await settleEntry(repos, userId, id, raw.data.settledOn ?? today()) : await unsettleEntry(repos, userId, id);
    return json({ entry });
  });
}
