import { BookOpen, CreditCard, Home, Landmark, LineChart, List, MoreHorizontal, PieChart, Plus, Repeat, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/entries" | "/add" | "/net-worth" | "/more";
  label: string;
  icon: LucideIcon;
  /** In the sidebar only: the phone's bar keeps four tabs, and this screen sits under More there. */
  desktopOnly?: boolean;
}

/** Sidebar on desktop, bottom bar on mobile (PROMPT.md §7). Home is the month; Entries is the list it is made of; Net worth is looked at more often than the portfolio (DESIGN.md 2026-09-18). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/entries", label: "Entries", icon: List, desktopOnly: true },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/net-worth", label: "Net worth", icon: LineChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

/** The phone's bar: Home · Add · Net worth · More. */
export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.desktopOnly);

/** Entries on the phone: first under More. */
export const ENTRIES_ITEM = NAV_ITEMS.find((item) => item.href === "/entries")!;

/** What "More" holds on mobile; the desktop sidebar lists these directly. Accounts here is the money view (balances, entries); adding and editing accounts is in Settings. */
export const MORE_ITEMS: { href: "/cards" | "/accounts" | "/recurrences" | "/portfolio" | "/guide"; label: string; icon: LucideIcon }[] = [
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/accounts", label: "Accounts", icon: Landmark },
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
export const MORE_PATHS = ["/more", "/entries", "/cards", "/recurrences", "/portfolio", "/settings", "/guide", "/accounts"];

/** Screens whose form pins its Save bar above the nav, so toasts sit higher there. */
export function isFormScreen(pathname: string): boolean {
  return pathname === "/add" || /^\/entries\/[^/]+$/.test(pathname);
}

export function isNavActive(href: NavItem["href"], pathname: string): boolean {
  if (href === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
