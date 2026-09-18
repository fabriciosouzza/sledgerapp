import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Donut } from "@/components/charts/donut";
import { SpendLine } from "@/components/charts/spend-line";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryTable } from "@/components/month/category-table";
import { MonthPicker } from "@/components/month/month-picker";
import { ViewSwitch, type MonthView } from "@/components/month/view-switch";
import { GenerateMonth } from "@/components/recurrences/generate-month";
import { YearView } from "./year-view";
import { Stat } from "@/components/month/stat";
import { addMonths, dayOf, isPeriod, parsePeriod, periodOf, today, toPeriodString } from "@/lib/domain/dates";
import { formatBRL, formatPercent } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { pendingMonths, previewGeneration } from "@/lib/services/recurrences";
import { capsOver, monthSummary, yearSummary } from "@/lib/services/summary";
import { cn } from "@/lib/utils";

/** "+5% vs last month · + R$ 100,00 planned", or whichever half exists; `—` is never faked as 0%. */
function deltaHint(delta: number | null, plannedCents: number, throughDay: number | null): string | undefined {
  const parts: string[] = [];
  if (delta !== null) parts.push(`${delta >= 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))}% vs ${throughDay === null ? "last month" : "the same days last month"}`);
  if (plannedCents > 0) parts.push(`+ ${formatBRL(plannedCents)} planned`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export default async function MonthPage(props: PageProps<"/review">) {
  const sp = await props.searchParams;
  const now = today();
  const month = typeof sp.month === "string" && isPeriod(sp.month) ? sp.month : periodOf(now);
  const view: MonthView = sp.view === "year" || sp.view === "rolling" ? sp.view : "month";
  const { year } = parsePeriod(month);
  const hrefs = { month: `/review?month=${month}`, year: `/review?view=year&month=${month}`, rolling: `/review?view=rolling&month=${month}` };

  const { userId, repos } = await getContext();

  if (view !== "month") {
    // "12 months" is always the current month and the eleven before it.
    const current = periodOf(now);
    const from = view === "year" ? toPeriodString(year, 1) : addMonths(current, -11);
    const to = view === "year" ? toPeriodString(year, 12) : current;
    const summary = await yearSummary(repos, userId, from, to);
    return (
      <>
        <PageHeader title="Review" />
        <div className="space-y-6">
          <ViewSwitch view={view} hrefs={hrefs} />
          <YearView
            summary={summary}
            title={view === "year" ? String(year) : "Last 12 months"}
            prevHref={view === "year" ? `/review?view=year&month=${toPeriodString(year - 1, 1)}` : undefined}
            nextHref={view === "year" ? `/review?view=year&month=${toPeriodString(year + 1, 1)}` : undefined}
          />
        </div>
      </>
    );
  }

  const [summary, accounts, categories, generation, pendingAll] = await Promise.all([
    monthSummary(repos, userId, month),
    listAccounts(repos, userId),
    listCategories(repos, userId),
    previewGeneration(repos, userId, month),
    pendingMonths(repos, userId, now),
  ]);
  const m = summary.metrics;
  const isCurrent = month === periodOf(now);
  const budgetPct = summary.budgetCents ? Math.round((summary.budgetSpentCents / summary.budgetCents) * 100) : 0;
  const budgetWord = summary.budgetStatus === "over" ? "over" : summary.budgetStatus === "risk" ? "at risk" : "within";
  const uncappedCents = m.expenseCents - summary.budgetSpentCents;
  // The verdict names blown caps, not only the overall share.
  const overCount = capsOver(summary.categories).length;

  return (
    <>
      <PageHeader title="Review" />
      <div className="space-y-6">
        <ViewSwitch view={view} hrefs={hrefs} />
        <MonthPicker period={month} basePath="/review" />

        <GenerateMonth
          key={month}
          period={month}
          card
          toCreate={generation.toCreate.map((r) => ({
            recurrenceId: r.recurrence.id,
            description: r.description,
            kind: r.kind,
            amountCents: r.amountCents,
            date: r.date,
            isVariable: r.recurrence.isVariable,
          }))}
          existingCount={generation.existing.length}
          otherPending={pendingAll.filter((m) => m.period !== month)}
        />

        {/* The month in numbers first — the verdict (savings rate, leftover, budget) leads, the flows follow — then what is still to settle; the charts close. */}
        <section aria-label="Summary" className="space-y-1">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              label="Savings rate"
              rate={m.savingsRate}
              tone="signed"
              hint={m.savingsRateExEarmarked !== null && m.earmarkedCents > 0 ? `${formatPercent(m.savingsRateExEarmarked)} ex-earmarked · earmarked ${formatBRL(m.earmarkedCents)}` : undefined}
              className={cn("col-span-2", summary.budgetCents === null && "lg:col-span-3")}
            />
            <Stat label="Leftover" cents={m.leftoverCents} tone="signed" href={`/entries?month=${month}`} />
            {summary.budgetCents !== null && (
              <Stat
                label="Budget"
                text={`${budgetPct}% · ${overCount > 0 ? `${overCount} ${overCount === 1 ? "cap" : "caps"} over` : budgetWord}`}
                tone={summary.budgetStatus === "over" || overCount > 0 ? "negative" : summary.budgetStatus === "risk" ? "caution" : "neutral"}
                href="#by-category"
              />
            )}
            <Stat label="Income" cents={m.incomeCents} hint={deltaHint(summary.delta.throughDay === null ? summary.delta.income : null, m.plannedIncomeCents, summary.delta.throughDay)} href={`/entries?month=${month}&kind=income`} />
            <Stat label="Expense" cents={m.expenseCents} hint={deltaHint(summary.delta.expense, m.plannedExpenseCents, summary.delta.throughDay)} href={`/entries?month=${month}&kind=expense`} />
            <Stat label="Contributions" cents={m.contributionsCents} hint={m.redemptionsCents > 0 ? `− ${formatBRL(m.redemptionsCents)} redeemed` : undefined} href={`/entries?month=${month}&kind=moves`} />
            <Stat label="Fixed cost" cents={m.fixedCostCents} hint={summary.installmentsCents > 0 ? `+ ${formatBRL(summary.installmentsCents)} in installments this month` : undefined} />
          </div>
          {/* The formulas live in the guide, not under every number. */}
          <Link href="/guide#the-numbers" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            How each number is worked out <ArrowRight className="size-3" aria-hidden />
          </Link>
        </section>
        <section id="still-planned" className="scroll-mt-4">
          <EntryList
            key={month}
            title="Still planned"
            initial={summary.planned}
            period={month}
            filters={{ status: "planned" }}
            lookups={buildLookups(accounts, categories)}
            today={now}
            infinite={false}
            ascending
            emptyMessage="Nothing left to settle this month."
          />
        </section>

        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Spending through the month</h2>
            <span className="text-xs text-muted-foreground">grey: last month</span>
          </div>
          <SpendLine current={summary.dailySpend.current} previous={summary.dailySpend.previous} upToDay={isCurrent ? dayOf(now) : undefined} />
        </section>

        <section id="by-category" className="scroll-mt-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-semibold">By category</h2>
            {summary.budgetCents !== null && (
              <span className="text-xs tabular-nums">
                {formatBRL(summary.budgetSpentCents)} of {formatBRL(summary.budgetCents)} ·{" "}
                <span className={`font-medium ${summary.budgetStatus === "over" ? "text-negative" : summary.budgetStatus === "risk" ? "text-caution" : "text-muted-foreground"}`}>
                  {budgetPct}% · {budgetWord}
                </span>
              </span>
            )}
          </div>
          {summary.budgetCents !== null && (
            <div className="mb-3 space-y-1.5">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.min(100, budgetPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${budgetPct}% of the budget, ${budgetWord}`}
                aria-label="Budget usage"
              >
                <div
                  className={`h-full rounded-full ${summary.budgetStatus === "over" ? "bg-negative" : summary.budgetStatus === "risk" ? "bg-caution" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
              {uncappedCents > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {formatBRL(uncappedCents)} in categories without a cap, not counted
                </p>
              )}
            </div>
          )}
          {summary.categories.length > 0 && (
            <div className="mb-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <Donut slices={summary.categories.map((c) => ({ name: c.name, cents: c.settledCents, color: c.color ?? undefined }))} label="Expense by category" centerLabel="settled" />
            </div>
          )}
          <CategoryTable lines={summary.categories} href={(id) => `/entries?month=${month}&kind=expense&category=${id}`} />
        </section>
      </div>
    </>
  );
}
