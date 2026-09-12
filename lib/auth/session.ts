// Supabase-specific auth adapter (PROMPT.md §4.4). Everything else in the app
// sees only `SessionUser`.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/client";

export interface SessionUser {
  id: string;
  email: string | null;
}

/** The signed-in user, verified against the auth server; `null` when signed out. */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** For screens and actions that need a user: redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
