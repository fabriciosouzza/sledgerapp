"use server";

import { revalidatePath } from "next/cache";
import { today } from "@/lib/domain/dates";
import { entryInputSchema } from "@/lib/schemas/entries";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { getContext } from "@/lib/services/context";
import { createEntry } from "@/lib/services/entries";
import { ServiceError } from "@/lib/services/errors";

export type CreateEntryActionResult =
  | { ok: true; count: number; recurrence: boolean; firstId: string | null; description: string; amountCents: number }
  | { ok: false; error: string };

export async function createEntryAction(formData: FormData): Promise<CreateEntryActionResult> {
  const { userId, repos } = await getContext();
  const parsed = entryInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const result = await createEntry(repos, userId, parsed.data, { today: today() });
    revalidateEntries();
    const first = result.entries[0] ?? null;
    return { ok: true, count: result.entries.length, recurrence: result.recurrence !== null, firstId: first?.id ?? null, description: first?.description ?? "", amountCents: first?.amountCents ?? 0 };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function revalidateEntries(): Promise<void> {
  for (const path of ["/", "/entries", "/review", "/cards", "/recurrences", "/net-worth", "/accounts/[id]"]) revalidatePath(path, "page");
}
