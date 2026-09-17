import { BookOpen, CalendarDays, Coins, CreditCard, Home, Landmark, LineChart, List, MoreHorizontal, PieChart, Plus, Repeat, Settings, type LucideIcon } from "lucide-react";

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

/** What "More" holds on mobile; the desktop sidebar lists these directly. Accounts and assets are data, not settings, so they sit here. */
export const MORE_ITEMS: { href: "/entries" | "/cards" | "/settings/accounts" | "/recurrences" | "/net-worth" | "/settings/assets" | "/guide"; label: string; icon: LucideIcon }[] = [
  { href: "/entries", label: "Entries", icon: List },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/settings/accounts", label: "Accounts", icon: Landmark },
  { href: "/recurrences", label: "Recurrences", icon: Repeat },
  { href: "/net-worth", label: "Net worth", icon: LineChart },
  { href: "/settings/assets", label: "Assets", icon: Coins },
  { href: "/guide", label: "How it works", icon: BookOpen },
];

/** Settings proper — profile, categories, theme — sits with the profile at the foot of the sidebar and at the end of More. */
export const SETTINGS_ITEM = { href: "/settings" as const, label: "Settings", icon: Settings };

/** Settings is the current screen only for what it still holds; Accounts and Assets have their own items. */
export function isSettingsActive(pathname: string): boolean {
  return pathname.startsWith("/settings") && !pathname.startsWith("/settings/accounts") && !pathname.startsWith("/settings/assets");
}

/** Screens reachable from "More" that share its highlighted nav item. */
export const MORE_PATHS = ["/more", "/entries", "/cards", "/recurrences", "/net-worth", "/settings", "/guide", "/accounts"];

/** Screens whose form pins its Save bar above the nav: the raised "+" would sit on it, so it lies flat there. */
export function isFormScreen(pathname: string): boolean {
  return pathname === "/add" || /^\/entries\/[^/]+$/.test(pathname);
}

export function isNavActive(href: NavItem["href"], pathname: string): boolean {
  if (href === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
