"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AddSheet } from "./add-sheet";
import { NAV_ITEMS, isFormScreen, isNavActive } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      id="main-nav"
      tabIndex={-1}
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          if (href === "/add") {
            return (
              <li key={href} className="flex min-w-0 items-start justify-center">
                <AddSheet flat={isFormScreen(pathname)} current={pathname === "/add"} />
              </li>
            );
          }
          const active = isNavActive(href, pathname);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {/* Under large text the label truncates instead of widening the bar past the screen. */}
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
