// Protects everything except /login and /auth/callback (PROMPT.md §7).
// The Supabase-specific part lives in lib/auth/proxy.ts.

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets; run on every page and route handler.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
