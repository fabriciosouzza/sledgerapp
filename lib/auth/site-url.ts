import { headers } from "next/headers";

/**
 * Where email links come back to. `NEXT_PUBLIC_SITE_URL` when set (production);
 * otherwise the request's own host, which is what local development needs.
 * Supabase only redirects to URLs on its allowlist either way.
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
