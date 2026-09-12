"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-background px-3 py-5 md:flex">
      <Link href="/" className="px-3 text-lg font-semibold tracking-tight">
        sledger
      </Link>
      <nav aria-label="Main" className="mt-6 flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-3">
        <ThemeToggle compact />
        {email && <p className="truncate px-3 text-xs text-muted-foreground">{email}</p>}
      </div>
    </aside>
  );
}
