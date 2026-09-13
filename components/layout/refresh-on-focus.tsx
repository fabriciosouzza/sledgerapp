"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Two people, two devices, one ledger: a tab left open all day shows the
 * morning. Coming back to it (focus, or the tab becoming visible again)
 * re-fetches the server components, so what the other person recorded shows up.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
