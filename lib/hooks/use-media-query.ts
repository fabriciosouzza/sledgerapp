"use client";

import { useSyncExternalStore } from "react";

/** `true` when the viewport matches; `false` on the server and during hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `md` breakpoint: sidebar layout, dialogs instead of sheets. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
