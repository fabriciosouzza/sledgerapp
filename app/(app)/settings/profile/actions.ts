"use server";

import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/auth/site-url";
import { redirect } from "next/navigation";
import { deleteUser, updateEmail, updateName, updatePassword } from "@/lib/auth/adapter";
import { getUser } from "@/lib/auth/session";
import { changePasswordSchema, emailSchema, nameSchema } from "@/lib/schemas/auth";

export interface ProfileState {
  error?: string;
  message?: string;
}

export async function updateNameAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await updateName(parsed.data);
  if (!result.ok) return { error: result.error };
  for (const path of ["/settings/profile", "/settings", "/"]) revalidatePath(path);
  return { message: "Name saved." };
}

export async function updatePasswordAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = changePasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await updatePassword(parsed.data.password);
  if (!result.ok) return { error: result.error };
  return { message: "Password changed." };
}

export async function deleteAccountAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Sign in required." };
  if (String(formData.get("confirm") ?? "") !== (user.email ?? "")) return { error: "Type your email exactly to confirm." };
  const result = await deleteUser(user.id);
  if (!result.ok) return { error: result.error };
  redirect("/login");
}

export async function updateEmailAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await updateEmail(parsed.data, `${await siteUrl()}/auth/callback?next=/settings/profile`);
  if (!result.ok) return { error: result.error };
  return { message: `Check ${parsed.data} (and the current address) for the confirmation links.` };
}
