import Link from "next/link";
import { cn } from "@/lib/utils";

export type YearRange = "year" | "rolling";

/** Calendar year · last 12 months, as links so the URL is the state. */
export function ViewSwitch({ view, hrefs }: { view: YearRange; hrefs: Record<YearRange, string> }) {
  const items: { value: YearRange; label: string }[] = [
    { value: "year", label: "Calendar year" },
    { value: "rolling", label: "Last 12 months" },
  ];
  return (
    <nav aria-label="Range" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.value}
          href={hrefs[item.value]}
          aria-current={view === item.value ? "page" : undefined}
          className={cn(
            "flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            view === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
