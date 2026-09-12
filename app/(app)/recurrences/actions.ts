"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { recurrenceInputSchema } from "@/lib/schemas/recurrences";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { createRecurrence, deleteRecurrence, updateRecurrence } from "@/lib/services/recurrences";

export interface RecurrenceFormState {
  error?: string;
  values?: Record<string, string | string[]>;
}

const LIST = "/recurrences";

function revalidate() {
  for (const path of [LIST, "/recurrences/[id]", "/", "/month", "/entries"]) revalidatePath(path, "page");
}

export async function createRecurrenceAction(_prev: RecurrenceFormState, formData: FormData): Promise<RecurrenceFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const parsed = recurrenceInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  try {
    await createRecurrence(repos, userId, parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function updateRecurrenceAction(_prev: RecurrenceFormState, formData: FormData): Promise<RecurrenceFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const parsed = recurrenceInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  try {
    await updateRecurrence(repos, userId, String(values.id ?? ""), parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function deleteRecurrenceAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  try {
    await deleteRecurrence(repos, userId, String(formData.get("id") ?? ""));
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  redirect(LIST);
}
