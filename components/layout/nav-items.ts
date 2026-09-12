import { CalendarDays, Home, MoreHorizontal, PieChart, Plus, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/add" | "/month" | "/portfolio" | "/more";
  label: string;
  icon: LucideIcon;
}

/** Bottom nav on mobile, sidebar on desktop (PROMPT.md §7); the add button sits in the middle as a FAB. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/month", label: "Month", icon: CalendarDays },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

/** Screens reachable from "More" that share its highlighted nav item. */
export const MORE_PATHS = ["/more", "/entries", "/cards", "/recurrences", "/net-worth", "/settings", "/guide"];

export function isNavActive(href: NavItem["href"], pathname: string): boolean {
  if (href === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
