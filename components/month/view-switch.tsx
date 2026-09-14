import Link from "next/link";
import { cn } from "@/lib/utils";

export type MonthView = "month" | "year" | "rolling";

/** Month · Year · 12 months, as links so the URL is the state. */
export function ViewSwitch({ view, hrefs }: { view: MonthView; hrefs: Record<MonthView, string> }) {
  const items: { value: MonthView; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
    { value: "rolling", label: "12 months" },
  ];
  return (
    <nav aria-label="Range" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.value}
          href={hrefs[item.value]}
          aria-current={view === item.value ? "page" : undefined}
          className={cn(
            "flex h-11 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            view === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
