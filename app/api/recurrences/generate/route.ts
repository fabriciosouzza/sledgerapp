import { z } from "zod";
import { isPeriod, periodOf, today } from "@/lib/domain/dates";
import { generateMonth, previewGeneration } from "@/lib/services/recurrences";
import { json, parseBody, withUser } from "../../_lib/handler";

const bodySchema = z.object({
  period: z.string().refine(isPeriod, { error: "period must look like 2026-11." }).optional(),
  /** Preview only: what a run would create. */
  dryRun: z.boolean().default(false),
});

/** POST /api/recurrences/generate  { period?: "2026-11", dryRun?: true } */
export async function POST(request: Request) {
  return withUser(async ({ userId, repos }) => {
    const raw = request.headers.get("content-type") === null ? { data: bodySchema.parse({}) } : await parseBody(request, bodySchema);
    if ("response" in raw) return raw.response;
    const period = raw.data.period ?? periodOf(today());
    if (raw.data.dryRun) {
      const preview = await previewGeneration(repos, userId, period);
      const toCreate = preview.toCreate.map((row) => ({ ...row, recurrence: undefined }));
      return json({ period, wouldCreate: toCreate.length, existing: preview.existing.length, toCreate });
    }
    return json(await generateMonth(repos, userId, period));
  });
}
