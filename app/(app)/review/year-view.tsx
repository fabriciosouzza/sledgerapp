import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BudgetBars } from "@/components/charts/budget-bars";
import { Donut } from "@/components/charts/donut";
import { YearBars } from "@/components/charts/year-bars";
import { CategoryTable } from "@/components/month/category-table";
import { Stat } from "@/components/month/stat";
import { Button } from "@/components/ui/button";
import { formatPeriodShort, periodEnd, periodStart } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { YearSummary } from "@/lib/services/summary";

export function YearView({ summary, title, prevHref, nextHref }: { summary: YearSummary; title: string; prevHref?: string; nextHref?: string }) {
  const t = summary.totals;
  const rangeHref = `/entries?from=${periodStart(summary.from)}&to=${periodEnd(summary.to)}`;
  return (
    <div className="space-y-6">
      <div className={prevHref || nextHref ? "flex items-center justify-between gap-2" : "text-center"}>
        {prevHref ? (
          <Button variant="outline" size="icon-lg" className="size-[44px] shrink-0" aria-label="Previous year" render={<Link href={prevHref} />} nativeButton={false}>
            <ChevronLeft aria-hidden />
          </Button>
        ) : prevHref === undefined && nextHref === undefined ? null : (
          <span className="size-[44px] shrink-0" />
        )}
        <div className="text-center">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            {formatPeriodShort(summary.from)} → {formatPeriodShort(summary.to)}
          </p>
        </div>
        {nextHref ? (
          <Button variant="outline" size="icon-lg" className="size-[44px] shrink-0" aria-label="Next year" render={<Link href={nextHref} />} nativeButton={false}>
            <ChevronRight aria-hidden />
          </Button>
        ) : prevHref === undefined && nextHref === undefined ? null : (
          <span className="size-[44px] shrink-0" />
        )}
      </div>

      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-2 md:grid-cols-3">
        <Stat label="Income" cents={t.incomeCents} href={`${rangeHref}&kind=income`} />
        <Stat label="Expense" cents={t.expenseCents} href={`${rangeHref}&kind=expense`} />
        <Stat label="Contributions" cents={t.contributionsCents} hint={t.redemptionsCents > 0 ? `− ${formatBRL(t.redemptionsCents)} redeemed` : undefined} href={`${rangeHref}&kind=moves`} />
        <Stat label="Leftover" cents={t.leftoverCents} tone="signed" href={rangeHref} />
        <Stat label="Savings rate" rate={t.savingsRate} tone="signed" />
        <Stat label="Savings rate ex-earmarked" rate={t.savingsRateExEarmarked} tone="signed" />
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 text-sm font-semibold">Month by month</h2>
        <YearBars months={summary.months} />
      </section>

      {/* Discipline month after month is a question about the year, not about one month (DESIGN.md 2026-09-18). */}
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 text-sm font-semibold">Budget, month by month</h2>
        <BudgetBars months={summary.budget} />
      </section>

      {summary.categories.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">By category</h2>
          <div className="mb-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Donut slices={summary.categories.map((c) => ({ name: c.name, cents: c.settledCents, color: c.color ?? undefined }))} label="Expense by category" centerLabel="settled" />
          </div>
          <CategoryTable lines={summary.categories} href={(id) => `${rangeHref}&kind=expense&category=${id}`} />
        </section>
      )}
    </div>
  );
}
