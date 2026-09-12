"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { categoryInputSchema } from "@/lib/schemas/categories";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";

export interface CategoryFormState {
  error?: string;
  values?: Record<string, string | string[]>;
}

const LIST = "/settings/categories";

function revalidate() {
  revalidatePath(LIST);
  revalidatePath("/settings/categories/[id]", "page");
}

export async function createCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  try {
    await createCategory(repos, userId, parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function updateCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const id = String(values.id ?? "");
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  try {
    await updateCategory(repos, userId, id, parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  await moveCategory(repos, userId, id, direction);
  revalidate();
  revalidatePath("/add");
}

export async function deleteCategoryAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  try {
    await deleteCategory(repos, userId, id);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  redirect(LIST);
}
