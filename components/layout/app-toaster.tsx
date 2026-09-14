"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { isFormScreen } from "./nav-items";

/** Toasts sit at the bottom, near the thumb that just settled something: above the nav, and above the pinned Save bar on form screens. */
export function AppToaster() {
  const pathname = usePathname();
  const bottom = `calc(3.5rem + env(safe-area-inset-bottom) + ${isFormScreen(pathname) ? "5.25rem" : "0.75rem"})`;
  return <Toaster position="bottom-center" duration={6000} offset={{ bottom }} mobileOffset={{ bottom }} />;
}
