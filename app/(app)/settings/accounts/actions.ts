"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountInputSchema } from "@/lib/schemas/accounts";
import { firstIssue, formToObject } from "@/lib/schemas/form";
import { createAccount, deleteAccount, moveAccount, setAccountActive, updateAccount } from "@/lib/services/accounts";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";

export interface AccountFormState {
  error?: string;
  values?: Record<string, string | string[]>;
}

const LIST = "/settings/accounts";

function revalidate() {
  revalidatePath(LIST);
  revalidatePath("/settings/accounts/[id]", "page");
  revalidatePath("/");
}

export async function createAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const parsed = accountInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  try {
    await createAccount(repos, userId, parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function updateAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const { userId, repos } = await getContext();
  const values = formToObject(formData);
  const id = String(values.id ?? "");
  const parsed = accountInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  try {
    await updateAccount(repos, userId, id, parsed.data);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message, values };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function deleteAccountAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  try {
    await deleteAccount(repos, userId, id);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  redirect(LIST);
}

export async function moveAccountAction(formData: FormData): Promise<void> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  await moveAccount(repos, userId, id, direction);
  revalidate();
}

export async function toggleAccountAction(formData: FormData): Promise<void> {
  const { userId, repos } = await getContext();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await setAccountActive(repos, userId, id, isActive);
  revalidate();
}
