"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assetInputSchema, newAssetSchema } from "@/lib/schemas/assets";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { createAsset, deleteAsset, updateAsset } from "@/lib/services/portfolio";

export interface AssetFormState {
  error?: string;
  values?: Record<string, string | string[]>;
}

const LIST = "/settings/assets";

function revalidate() {
  for (const path of [LIST, "/settings/assets/[id]", "/portfolio"]) revalidatePath(path, "page");
}

export async function createAssetAction(_prev: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const parsed = newAssetSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  try {
    await createAsset(repos, userId, parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function updateAssetAction(_prev: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const parsed = assetInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  try {
    await updateAsset(repos, userId, String(values.id ?? ""), parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function deleteAssetAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  try {
    await deleteAsset(repos, userId, String(formData.get("id") ?? ""));
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  redirect(LIST);
}
