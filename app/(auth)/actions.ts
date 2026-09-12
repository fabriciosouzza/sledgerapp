"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendMagicLink, signInWithPassword, signOut as signOutAdapter, signUp } from "@/lib/auth/adapter";
import { credentialsSchema, magicLinkSchema } from "@/lib/schemas/auth";
import { getRepositories } from "@/lib/services/context";
import { seedUserIfEmpty } from "@/lib/services/seed";

/**
 * Seeds a first-time user (§10). Never blocks the sign-in: the user is in
 * either way, and the empty states offer the starting set again.
 */
async function seedAfterSignIn(userId: string | null): Promise<void> {
  if (!userId) return;
  const repos = await getRepositories();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await seedUserIfEmpty(repos, userId);
      return;
    } catch (error) {
      console.error(`seed after sign-in failed (attempt ${attempt})`, error);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

export interface AuthFormState {
  error?: string;
  message?: string;
  email?: string;
}

async function callbackUrl(next: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}/auth/callback?next=${encodeURIComponent(next)}`;
}

function nextPath(formData: FormData): string {
  const next = formData.get("next");
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const result = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error, email };

  await seedAfterSignIn(result.userId);
  redirect(nextPath(formData));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const next = nextPath(formData);
  const result = await signUp(parsed.data.email, parsed.data.password, await callbackUrl(next));
  if (!result.ok) return { error: result.error, email };

  // Confirmation off (local default): signed in already. On: a link was sent.
  const signedIn = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (signedIn.ok) {
    await seedAfterSignIn(signedIn.userId);
    redirect(next);
  }
  return { message: "Account created. Check your email to confirm it.", email };
}

export async function magicLinkAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = magicLinkSchema.safeParse({ email });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const result = await sendMagicLink(parsed.data.email, await callbackUrl(nextPath(formData)));
  if (!result.ok) return { error: result.error, email };
  return { message: `Magic link sent to ${parsed.data.email}.`, email };
}

export async function signOutAction(): Promise<void> {
  await signOutAdapter();
  redirect("/login");
}
