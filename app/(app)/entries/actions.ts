"use server";

import { revalidatePath } from "next/cache";
import { isIsoDate, today } from "@/lib/domain/dates";
import type { AllocationLine, Entry, Period } from "@/lib/domain/types";
import type { EntryFilters } from "@/lib/repositories";
import { allocationField, readAllocationFields } from "@/lib/schemas/allocation";
import { entryUpdateSchema, installmentScopeSchema } from "@/lib/schemas/entries";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { getContext } from "@/lib/services/context";
import { deleteEntry, listEntries, settleEntries, settleEntry, suggestAllocation, unsettleEntries, unsettleEntry, updateEntry, type AllocationSuggestion } from "@/lib/services/entries";
import { ServiceError } from "@/lib/services/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  for (const path of ["/", "/year", "/entries", "/cards", "/net-worth", "/accounts/[id]", "/portfolio", "/portfolio/[id]"]) revalidatePath(path, "page");
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

/** `allocation`: where a contribution goes (§5.2); other kinds ignore it. */
export async function settleEntryAction(id: string, settledOn?: string, allocation?: AllocationLine[]): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  if (settledOn !== undefined && !isIsoDate(settledOn)) return { ok: false, error: "Pick a date." };
  const lines = allocationField.safeParse(allocation ?? null);
  if (!lines.success) return { ok: false, error: firstIssue(lines.error) };
  return run(() => settleEntry(repos, userId, id, settledOn ?? today(), lines.data));
}

/** What the allocation sheet opens with: the assets, and the split the recurrence suggests. */
export async function allocationSuggestionAction(id: string): Promise<{ ok: true; suggestion: AllocationSuggestion } | { ok: false; error: string }> {
  const { userId, repos } = await getContext();
  try {
    return { ok: true, suggestion: await suggestAllocation(repos, userId, id) };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function unsettleEntryAction(id: string): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  return run(() => unsettleEntry(repos, userId, id));
}

export async function settleManyAction(ids: string[], settledOn?: string): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  if (settledOn !== undefined && !isIsoDate(settledOn)) return { ok: false, error: "Pick a date." };
  return run(() => settleEntries(repos, userId, ids, settledOn ?? today()));
}

export async function unsettleManyAction(ids: string[]): Promise<ActionResult> {
  const { userId, repos } = await getContext();
  return run(() => unsettleEntries(repos, userId, ids));
}

export async function deleteEntryAction(formData: FormData): Promise<{ error?: string; deleted?: number }> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  const scope = installmentScopeSchema.catch("this").parse(formData.get("scope"));
  let deleted: number;
  try {
    deleted = await deleteEntry(repos, userId, id, scope);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  return { deleted };
}

export type UpdateEntryActionResult = { ok: true; count: number } | { ok: false; error: string };

export async function updateEntryAction(formData: FormData): Promise<UpdateEntryActionResult> {
  const { userId, repos } = await getContext();
  const parsed = entryUpdateSchema.safeParse({ ...formToObject(formData), allocation: readAllocationFields(formData).allocation });
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
