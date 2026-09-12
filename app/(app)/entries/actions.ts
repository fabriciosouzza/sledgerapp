"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { today } from "@/lib/domain/dates";
import type { Entry, Period } from "@/lib/domain/types";
import type { EntryFilters } from "@/lib/repositories";
import { entryUpdateSchema, installmentScopeSchema } from "@/lib/schemas/entries";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { getContext } from "@/lib/services/context";
import { deleteEntry, listEntries, settleEntries, settleEntry, unsettleEntry, updateEntry } from "@/lib/services/entries";
import { ServiceError } from "@/lib/services/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  for (const path of ["/", "/entries", "/month", "/cards"]) revalidatePath(path);
}

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidate();
    return { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function settleEntryAction(id: string, settledOn?: string): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  return run(() => settleEntry(repos, userId, id, settledOn ?? today()));
}

export async function unsettleEntryAction(id: string): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  return run(() => unsettleEntry(repos, userId, id));
}

export async function settleManyAction(ids: string[]): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  return run(() => settleEntries(repos, userId, ids, today()));
}

export async function deleteEntryAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  const scope = installmentScopeSchema.catch("this").parse(formData.get("scope"));
  try {
    await deleteEntry(repos, userId, id, scope);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  redirect("/entries");
}

export type UpdateEntryActionResult = { ok: true; count: number } | { ok: false; error: string };

export async function updateEntryAction(formData: FormData): Promise<UpdateEntryActionResult> {
  const { userId, repos } = await getContext();
  const parsed = entryUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const updated = await updateEntry(repos, userId, parsed.data);
    revalidate();
    return { ok: true, count: updated.length };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

/** One more month for the infinite list. */
export async function loadMonthAction(period: Period, filters: Omit<EntryFilters, "period" | "from" | "to">): Promise<Entry[]> {
  const { userId, repos } = await getContext();
  return listEntries(repos, userId, { ...filters, period });
}
