import Link from "next/link";
import { ChevronRight, CreditCard, LineChart, List, LogOut, Repeat, Settings } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/entries", label: "Entries", description: "Every entry, filter and bulk settle", icon: List },
  { href: "/cards", label: "Cards", description: "Statements per credit card", icon: CreditCard },
  { href: "/recurrences", label: "Recurrences", description: "Fixed cost and month generation", icon: Repeat },
  { href: "/net-worth", label: "Net worth", description: "Monthly snapshots", icon: LineChart },
  { href: "/settings", label: "Settings", description: "Accounts, categories, assets", icon: Settings },
] as const;

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
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline" className="h-11 w-full">
          <LogOut data-icon="inline-start" aria-hidden />
          Sign out
        </Button>
      </form>
    </>
  );
}
