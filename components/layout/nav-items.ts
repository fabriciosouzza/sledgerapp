import { BookOpen, CalendarDays, CreditCard, Home, LineChart, List, MoreHorizontal, PieChart, Plus, Repeat, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/add" | "/review" | "/portfolio" | "/more";
  label: string;
  icon: LucideIcon;
}

/** Bottom nav on mobile, sidebar on desktop (PROMPT.md §7); the add button sits in the middle as a FAB. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/review", label: "Review", icon: CalendarDays },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

/** What "More" holds on mobile; the desktop sidebar lists these directly. */
export const MORE_ITEMS: { href: "/entries" | "/cards" | "/recurrences" | "/net-worth" | "/settings" | "/guide"; label: string; icon: LucideIcon }[] = [
  { href: "/entries", label: "Entries", icon: List },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/recurrences", label: "Recurrences", icon: Repeat },
  { href: "/net-worth", label: "Net worth", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/guide", label: "How it works", icon: BookOpen },
];

/** Screens reachable from "More" that share its highlighted nav item. */
export const MORE_PATHS = ["/more", "/entries", "/cards", "/recurrences", "/net-worth", "/settings", "/guide"];

export function isNavActive(href: NavItem["href"], pathname: string): boolean {
  if (href === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
