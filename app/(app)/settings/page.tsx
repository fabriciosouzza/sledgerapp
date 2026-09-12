import Link from "next/link";
import { ChevronRight, Coins, Landmark, LogOut, Tags } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { getContext } from "@/lib/services/context";

const SECTIONS = [
  { href: "/settings/accounts", label: "Accounts", description: "Cash, cards with closing and due days, brokerage", icon: Landmark },
  { href: "/settings/categories", label: "Categories", description: "Caps, benefits, sub-categories", icon: Tags },
  { href: "/settings/assets", label: "Assets", description: "What you invest in (stage 9)", icon: Coins },
] as const;

export default async function SettingsPage() {
  const { user } = await getContext();
  return (
    <>
      <PageHeader title="Settings" description={user.email ?? undefined} />
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {SECTIONS.map(({ href, label, description, icon: Icon }) => (
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
