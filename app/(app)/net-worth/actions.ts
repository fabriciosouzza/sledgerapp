"use server";

import { revalidatePath } from "next/cache";
import { isPeriod } from "@/lib/domain/dates";
import { parseBRL } from "@/lib/domain/money";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { saveSnapshot } from "@/lib/services/netWorth";

export type SnapshotActionResult = { ok: true; count: number } | { ok: false; error: string };

/** Fields arrive as `balance:<accountId>` = pt-BR amount; empty means "not this account". */
export async function saveSnapshotAction(formData: FormData): Promise<SnapshotActionResult> {
  const { userId, repos } = await getContext();
  const period = String(formData.get("period") ?? "");
  if (!isPeriod(period)) return { ok: false, error: "Pick a month." };

  const balances: { accountId: string; amountCents: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("balance:") || typeof value !== "string" || value.trim() === "") continue;
    const cents = parseBRL(value);
    if (cents === null) return { ok: false, error: "Enter amounts like 1.234,56." };
    balances.push({ accountId: key.slice("balance:".length), amountCents: cents });
  }

  try {
    const saved = await saveSnapshot(repos, userId, { period, balances });
    for (const path of ["/net-worth", "/", "/month"]) revalidatePath(path);
    return { ok: true, count: saved.length };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}
