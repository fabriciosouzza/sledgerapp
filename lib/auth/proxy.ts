// Supabase-specific (PROMPT.md §4.4): refreshes the session cookie on every
// request and does the optimistic redirect. Called from proxy.ts only.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/db/env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

/** PostgREST allows 30 s of skew; refresh well before that. */
const SKEW_SECONDS = 15;

export function issuedInTheFuture(accessToken: string): boolean {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString()) as { iat?: number };
    return typeof claims.iat === "number" && claims.iat > Math.floor(Date.now() / 1000) + SKEW_SECONDS;
  } catch {
    return false;
  }
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, anonKey } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // A token minted before the machine slept can be "from the future" for a
  // Docker VM whose clock is still catching up; PostgREST rejects it. Mint a
  // fresh one against the same clock before anything else runs.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session && issuedInTheFuture(sessionData.session.access_token)) {
    await supabase.auth.refreshSession();
  }

  // The call refreshes an expired session and writes the new cookie back.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Route handlers answer 401 themselves; only screens get redirected.
  if (pathname.startsWith("/api/")) return response;

  if (!user && !isPublicPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  if (user && pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
