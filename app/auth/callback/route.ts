import { NextResponse, type NextRequest } from "next/server";
import { completeEmailLink } from "@/lib/auth/adapter";

/** Where email links land: magic link, sign-up confirmation, recovery. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const params = code ? { code } : tokenHash && type ? { tokenHash, type } : null;
  if (!params) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Invalid link.")}`);

  const result = await completeEmailLink(params);
  if (!result.ok) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(result.error)}`);

  return NextResponse.redirect(`${origin}${next}`);
}

/** Only same-origin paths; never an absolute URL from the query string. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
