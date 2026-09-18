"use server";

import { revalidatePath } from "next/cache";
import { parseBRL } from "@/lib/domain/money";
import { batchInputSchema, batchKindSchema, movementInputSchema, movementUpdateSchema } from "@/lib/schemas/assets";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { addMovement, deleteMovement, recordBatch, updateMovement } from "@/lib/services/portfolio";

export type MovementActionResult = { ok: true; assetId: string; id: string } | { ok: false; error: string };

function revalidate() {
  for (const path of ["/portfolio", "/portfolio/[id]", "/", "/entries", "/net-worth"]) revalidatePath(path, "page");
}

export async function addMovementAction(formData: FormData): Promise<MovementActionResult> {
  const { userId, repos } = await getContext();
  const parsed = movementInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const movement = await addMovement(repos, userId, parsed.data);
    revalidate();
    return { ok: true, assetId: movement.assetId, id: movement.id };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function recordBatchAction(formData: FormData): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { userId, repos } = await getContext();
  const parsed = batchInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const values: { assetId: string; cents: number; kind?: "yield" | "market_adjustment" }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amount:") || typeof value !== "string" || value.trim() === "") continue;
    const cents = parseBRL(value);
    if (cents === null) return { ok: false, error: "Enter amounts like 1.234,56." };
    const assetId = key.slice("amount:".length);
    const kind = batchKindSchema.safeParse(formData.get(`kind:${assetId}`));
    values.push({ assetId, cents, kind: kind.success ? kind.data : undefined });
  }
  if (values.length === 0) return { ok: false, error: "Fill in at least one asset." };
  try {
    const created = await recordBatch(repos, userId, { ...parsed.data, values });
    revalidate();
    return { ok: true, count: created.length };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updateMovementAction(formData: FormData): Promise<MovementActionResult> {
  const { userId, repos } = await getContext();
  const parsed = movementUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const movement = await updateMovement(repos, userId, parsed.data);
    revalidate();
    return { ok: true, assetId: movement.assetId, id: movement.id };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deleteMovementAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  try {
    await deleteMovement(repos, userId, String(formData.get("id") ?? ""));
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  return {};
}
