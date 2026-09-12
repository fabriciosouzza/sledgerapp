// Supabase-specific auth adapter (PROMPT.md §4.4): sign in, sign up, magic
// link, sign out and the callback exchange. Returns plain results; the server
// actions in app/ decide what to show and where to redirect.

import { createClient } from "@/lib/db/client";

export type AuthResult = { ok: true; userId: string | null } | { ok: false; error: string };

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data.user.id };
}

/**
 * Creates the account. With email confirmation on, `userId` is set but there
 * is no session yet; with it off (local default) the user is signed in.
 */
export async function signUp(email: string, password: string, redirectTo: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data.user?.id ?? null };
}

export async function sendMagicLink(email: string, redirectTo: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: null };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/** Turns the `code` (PKCE) or `token_hash` from an email link into a session. */
export async function completeEmailLink(
  params: { code: string } | { tokenHash: string; type: string },
): Promise<AuthResult> {
  const supabase = await createClient();
  if ("code" in params) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { ok: false, error: error.message };
    return { ok: true, userId: data.user.id };
  }
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: params.tokenHash,
    type: params.type as "magiclink" | "signup" | "email" | "recovery" | "invite" | "email_change",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data.user?.id ?? null };
}
