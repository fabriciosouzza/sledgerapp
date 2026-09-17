import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { MORE_ITEMS, SETTINGS_ITEM } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const DESCRIPTIONS: Record<string, string> = {
  "/entries": "Every entry, filter and bulk settle",
  "/cards": "Statements per credit card",
  "/accounts": "Each account's balance and its entries",
  "/recurrences": "Fixed cost and month generation",
  "/net-worth": "Cash, investments and debt over time",
  "/settings": "Profile, accounts, categories, assets, theme",
  "/guide": "The terms and the weekly routine",
};
const LINKS = [...MORE_ITEMS, SETTINGS_ITEM].map((item) => ({ ...item, description: DESCRIPTIONS[item.href] ?? "" }));

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {LINKS.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Theme</h2>
        <ThemeToggle />
      </section>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline" className="h-11 w-full">
          <LogOut data-icon="inline-start" aria-hidden />
          Sign out
        </Button>
      </form>
    </>
  );
}
