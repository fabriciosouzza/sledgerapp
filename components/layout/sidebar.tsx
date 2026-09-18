"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { isSettingsActive, MORE_ITEMS, NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";
import { signOutAction } from "@/app/(auth)/actions";

const linkClass = (active: boolean) =>
  cn(
    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

/** Desktop: the primary screens, then everything "More" holds on mobile, then settings (the theme lives there) and sign out. */
export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((item) => item.href !== "/more");
  const exact = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-background px-3 py-5 md:flex">
      <Link href="/" className="px-3 text-lg font-semibold tracking-tight">
        sledger
      </Link>
      <nav aria-label="Main" className="mt-6 flex-1 space-y-6 overflow-y-auto">
        <ul className="space-y-1">
          {primary.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} aria-current={exact(href) ? "page" : undefined} className={linkClass(exact(href))}>
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="space-y-1 border-t border-border pt-4">
          {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} aria-current={exact(href) ? "page" : undefined} className={linkClass(exact(href))}>
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-2">
        <Link href={SETTINGS_ITEM.href} className={cn(linkClass(isSettingsActive(pathname)), "h-11")} title={email ?? undefined}>
          <SETTINGS_ITEM.icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{SETTINGS_ITEM.label}</span>
        </Link>
        <form action={signOutAction}>
          <button type="submit" className={cn(linkClass(false), "w-full")}>
            <LogOut className="size-4 shrink-0" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
