"use server";

import { revalidatePath } from "next/cache";
import { isPeriod } from "@/lib/domain/dates";
import { parseBRL } from "@/lib/domain/money";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { generateMonth } from "@/lib/services/recurrences";

export type GenerateResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

/** Fields: `period`, and `amount:<recurrenceId>` as pt-BR amounts for this month's overrides. */
export async function generateMonthWithAmountsAction(formData: FormData): Promise<GenerateResult> {
  const { userId, repos } = await getContext();
  const period = String(formData.get("period") ?? "");
  if (!isPeriod(period)) return { ok: false, error: "Pick a month." };

  const amounts: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amount:") || typeof value !== "string" || value.trim() === "") continue;
    const cents = parseBRL(value);
    if (cents === null) return { ok: false, error: "Enter amounts like 1.234,56." };
    amounts[key.slice("amount:".length)] = cents;
  }

  try {
    const result = await generateMonth(repos, userId, period, amounts);
    for (const path of ["/month", "/", "/entries", "/recurrences"]) revalidatePath(path);
    return { ok: true, created: result.created, skipped: result.skipped };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}
