"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { updateEmail, updateName, updatePassword } from "@/lib/auth/adapter";
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

export async function updateEmailAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const result = await updateEmail(parsed.data, `${proto}://${host}/auth/callback?next=/settings/profile`);
  if (!result.ok) return { error: result.error };
  return { message: `Check ${parsed.data} (and the current address) for the confirmation links.` };
}
