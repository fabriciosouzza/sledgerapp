import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Donut } from "@/components/charts/donut";
import { YearBars } from "@/components/charts/year-bars";
import { CategoryTable } from "@/components/month/category-table";
import { Stat } from "@/components/month/stat";
import { Button } from "@/components/ui/button";
import { formatPeriodShort } from "@/lib/domain/dates";
import type { YearSummary } from "@/lib/services/summary";

export function YearView({ summary, title, prevHref, nextHref }: { summary: YearSummary; title: string; prevHref?: string; nextHref?: string }) {
  const t = summary.totals;
  return (
    <div className="space-y-6">
      <div className={prevHref || nextHref ? "flex items-center justify-between gap-2" : "text-center"}>
        {prevHref ? (
          <Button variant="outline" size="icon-lg" className="size-11" aria-label="Previous year" render={<Link href={prevHref} />} nativeButton={false}>
            <ChevronLeft aria-hidden />
          </Button>
        ) : prevHref === undefined && nextHref === undefined ? null : (
          <span className="size-11" />
        )}
        <div className="text-center">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            {formatPeriodShort(summary.from)} → {formatPeriodShort(summary.to)}
          </p>
        </div>
        {nextHref ? (
          <Button variant="outline" size="icon-lg" className="size-11" aria-label="Next year" render={<Link href={nextHref} />} nativeButton={false}>
            <ChevronRight aria-hidden />
          </Button>
        ) : prevHref === undefined && nextHref === undefined ? null : (
          <span className="size-11" />
        )}
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-2">
        <Stat label="Income" cents={t.incomeCents} tone="positive" />
        <Stat label="Expense" cents={t.expenseCents} tone="negative" />
        <Stat label="Contributions" cents={t.contributionsCents} />
        <Stat label="Leftover" cents={t.leftoverCents} tone="signed" />
        <Stat label="Savings rate" rate={t.savingsRate} tone="signed" />
        <Stat label="Savings rate ex-benefits" rate={t.savingsRateExBenefits} tone="signed" />
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 text-sm font-semibold">Month by month</h2>
        <YearBars months={summary.months} />
      </section>

      {summary.categories.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">By category</h2>
          <div className="mb-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Donut slices={summary.categories.map((c) => ({ name: c.name, cents: c.settledCents, color: c.color ?? undefined }))} label="Expense by category" centerLabel="settled" />
          </div>
          <CategoryTable lines={summary.categories} />
        </section>
      )}
    </div>
  );
}
