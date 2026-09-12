// Supabase-specific (PROMPT.md §4.4). The only module that builds a database
// client; repositories import `createClient` from here and nothing else.

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

export type DbClient = SupabaseClient<Database>;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * PostgREST answers 401 "JWT issued at future" when a token's `iat` is more
 * than 30 s ahead of its own clock — a token minted before the machine slept,
 * checked by a Docker VM whose clock is still behind. The proxy refreshes
 * such tokens up front (lib/auth/proxy.ts); this is the second net: mint a
 * fresh token and retry once. Every other 401 is real.
 */
function withSkewRetry(getClient: () => DbClient | undefined): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.status !== 401 || !/issued at future/i.test(response.headers.get("www-authenticate") ?? "")) return response;
    const client = getClient();
    if (!client) return response;
    console.warn("[db] JWT issued at future; refreshing the session and retrying");
    const { data } = await client.auth.refreshSession();
    const token = data.session?.access_token;
    if (!token) return response;
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}


/**
 * One client per request. The request's cookie store is the memo key: it is
 * the same object for every `cookies()` call in a render or a server action,
 * and a new one for the next request. (React's `cache` is not enough: it does
 * not dedupe across the calls of a server action.) Sharing the instance means
 * a sign-in and the queries that follow it use the same in-memory session.
 */
const clients = new WeakMap<CookieStore, DbClient>();

/**
 * The client bound to the current request's cookies. Cookie writes fail
 * silently inside Server Components (they cannot set headers); the proxy
 * refreshes sessions instead.
 */
export async function createClient(): Promise<DbClient> {
  // Cookies first: reading them marks the render dynamic, so a build without
  // env vars does not try to prerender screens that need a session.
  const cookieStore = await cookies();
  const existing = clients.get(cookieStore);
  if (existing) return existing;

  const { url, anonKey } = supabaseEnv();

  // What this request has written wins over what it arrived with, so a
  // sign-in is never followed by a read of the stale session it replaced.
  const written = new Map<string, string | null>();

  // Referenced by the fetch wrapper before it is assigned; only called after.
  const holder: { client?: DbClient } = {};
  const client = createServerClient<Database>(url, anonKey, {
    global: { fetch: withSkewRetry(() => holder.client) },
    cookies: {
      getAll() {
        const merged = new Map(cookieStore.getAll().map((c) => [c.name, c.value]));
        for (const [name, value] of written) {
          if (value === null) merged.delete(name);
          else merged.set(name, value);
        }
        return [...merged].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          written.set(name, options?.maxAge === 0 ? null : value);
        }
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
  holder.client = client;
  clients.set(cookieStore, client);
  return client;
}
