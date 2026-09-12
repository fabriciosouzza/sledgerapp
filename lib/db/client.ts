// Supabase-specific (PROMPT.md §4.4). The only module that builds a database
// client; repositories import `createClient` from here and nothing else.

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export type DbClient = SupabaseClient;

/**
 * A client bound to the current request's cookies. Create one per request —
 * never share across requests. Cookie writes fail silently inside Server
 * Components (they cannot set headers); the proxy refreshes sessions instead.
 */
export async function createClient(): Promise<DbClient> {
  // Cookies first: reading them marks the render dynamic, so a build without
  // env vars does not try to prerender screens that need a session.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; the proxy handles refreshes.
        }
      },
    },
  });
}
