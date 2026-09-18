import { BookOpen, CalendarRange, CreditCard, Home, Landmark, LineChart, List, MoreHorizontal, PieChart, Plus, Repeat, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/entries" | "/add" | "/net-worth" | "/more";
  label: string;
  icon: LucideIcon;
}

/** Bottom nav on mobile, sidebar on desktop (PROMPT.md §7); the add button sits in the middle as a FAB. Home is the month; Entries is the list it is made of; Net worth is looked at more often than the portfolio (DESIGN.md 2026-09-18). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/entries", label: "Entries", icon: List },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/net-worth", label: "Net worth", icon: LineChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

/** What "More" holds on mobile; the desktop sidebar lists these directly. Accounts here is the money view (balances, entries); adding and editing accounts is in Settings. */
export const MORE_ITEMS: { href: "/cards" | "/accounts" | "/year" | "/recurrences" | "/portfolio" | "/guide"; label: string; icon: LucideIcon }[] = [
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/year", label: "Year", icon: CalendarRange },
  { href: "/recurrences", label: "Recurrences", icon: Repeat },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/guide", label: "How it works", icon: BookOpen },
];

/** Settings — profile, accounts, categories, assets, theme — sits at the foot of the sidebar and at the end of More. */
export const SETTINGS_ITEM = { href: "/settings" as const, label: "Settings", icon: Settings };

export function isSettingsActive(pathname: string): boolean {
  return pathname.startsWith("/settings");
}

/** Screens reachable from "More" that share its highlighted nav item. */
export const MORE_PATHS = ["/more", "/cards", "/recurrences", "/portfolio", "/settings", "/guide", "/accounts", "/year"];

/** Screens whose form pins its Save bar above the nav: the raised "+" would sit on it, so it lies flat there. */
export function isFormScreen(pathname: string): boolean {
  return pathname === "/add" || /^\/entries\/[^/]+$/.test(pathname);
}

export function isNavActive(href: NavItem["href"], pathname: string): boolean {
  if (href === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
