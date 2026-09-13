// Supabase-specific auth adapter (PROMPT.md §4.4). Everything else in the app
// sees only `SessionUser`.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/client";

export interface SessionUser {
  id: string;
  email: string | null;
  /** Display name from the user's metadata; `null` until set. */
  name: string | null;
}

/** The signed-in user, verified against the auth server; `null` when signed out. */
/**
 * Who is signed in. The proxy already validated the session with the Auth
 * server on this request; here the token is verified locally (JWKS, cached)
 * when the project signs with an asymmetric key — no second round trip. With
 * a symmetric key the library falls back to the server, same as before.
 */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const claims = data.claims as { sub: string; email?: string; user_metadata?: { full_name?: unknown } };
  const name = claims.user_metadata?.full_name;
  return { id: claims.sub, email: claims.email ?? null, name: typeof name === "string" && name.trim() !== "" ? name : null };
}

/** For screens and actions that need a user: redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
