"use server";

import { revalidatePath } from "next/cache";
import { movementInputSchema } from "@/lib/schemas/assets";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { addMovement, deleteMovement } from "@/lib/services/portfolio";

export type MovementActionResult = { ok: true; assetId: string } | { ok: false; error: string };

function revalidate() {
  for (const path of ["/portfolio", "/portfolio/[id]", "/", "/entries", "/month", "/net-worth"]) revalidatePath(path, "page");
}

export async function addMovementAction(formData: FormData): Promise<MovementActionResult> {
  const { userId, repos } = await getContext();
  const parsed = movementInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const movement = await addMovement(repos, userId, parsed.data);
    revalidate();
    return { ok: true, assetId: movement.assetId };
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
