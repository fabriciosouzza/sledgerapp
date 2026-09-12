import { BudgetBars } from "@/components/charts/budget-bars";
import { Donut } from "@/components/charts/donut";
import { SpendLine } from "@/components/charts/spend-line";
import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryTable } from "@/components/month/category-table";
import { MonthPicker } from "@/components/month/month-picker";
import { ViewSwitch, type MonthView } from "@/components/month/view-switch";
import { YearView } from "./year-view";
import { Stat } from "@/components/month/stat";
import { addMonths, dayOf, isPeriod, parsePeriod, periodOf, today, toPeriodString } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { monthSummary, yearSummary } from "@/lib/services/summary";

export default async function MonthPage(props: PageProps<"/month">) {
  const sp = await props.searchParams;
  const now = today();
  const month = typeof sp.month === "string" && isPeriod(sp.month) ? sp.month : periodOf(now);
  const view: MonthView = sp.view === "year" || sp.view === "rolling" ? sp.view : "month";
  const { year } = parsePeriod(month);
  const hrefs = { month: `/month?month=${month}`, year: `/month?view=year&month=${month}`, rolling: `/month?view=rolling&month=${month}` };

  const { userId, repos } = await getContext();

  if (view !== "month") {
    const from = view === "year" ? toPeriodString(year, 1) : addMonths(month, -11);
    const to = view === "year" ? toPeriodString(year, 12) : month;
    const summary = await yearSummary(repos, userId, from, to);
    return (
      <>
        <PageHeader title="Month" />
        <div className="space-y-6">
          <ViewSwitch view={view} hrefs={hrefs} />
          <YearView
            summary={summary}
            title={view === "year" ? String(year) : "Last 12 months"}
            prevHref={view === "year" ? `/month?view=year&month=${toPeriodString(year - 1, 1)}` : `/month?view=rolling&month=${addMonths(month, -12)}`}
            nextHref={view === "year" ? `/month?view=year&month=${toPeriodString(year + 1, 1)}` : `/month?view=rolling&month=${addMonths(month, 12)}`}
          />
        </div>
      </>
    );
  }

  const [summary, accounts, categories] = await Promise.all([
    monthSummary(repos, userId, month),
    listAccounts(repos, userId),
    listCategories(repos, userId),
  ]);
  const m = summary.metrics;
  const isCurrent = month === periodOf(now);
  const budgetUsage = summary.budgetCents ? m.expenseCents / summary.budgetCents : null;
  const budgetColor =
    summary.budgetStatus === "over" ? "text-red-600 dark:text-red-400" : summary.budgetStatus === "risk" ? "text-amber-600 dark:text-amber-400" : "";

  return (
    <>
      <PageHeader title="Month" />
      <div className="space-y-6">
        <ViewSwitch view={view} hrefs={hrefs} />
        <MonthPicker period={month} basePath="/month" />

        <section aria-label="Summary" className="grid grid-cols-2 gap-2">
          <Stat label="Income" cents={m.incomeCents} tone="positive" hint={m.plannedIncomeCents ? `+ ${formatBRL(m.plannedIncomeCents)} planned` : undefined} />
          <Stat label="Expense" cents={m.expenseCents} tone="negative" hint={m.plannedExpenseCents ? `+ ${formatBRL(m.plannedExpenseCents)} planned` : undefined} />
          <Stat label="Contributions" cents={m.contributionsCents} />
          <Stat label="Leftover" cents={m.leftoverCents} tone="signed" hint="income − expense − contributions" />
          <Stat label="Savings rate" rate={m.savingsRate} tone="signed" />
          <Stat label="Savings rate ex-benefits" rate={m.savingsRateExBenefits} tone="signed" hint={m.benefitsCents ? `benefits ${formatBRL(m.benefitsCents)}` : undefined} />
          <Stat label="Fixed cost" cents={m.fixedCostCents} hint="active expense recurrences" />
          <Stat
            label="Months of runway"
            text={m.monthsOfRunway === null ? null : `${m.monthsOfRunway.toFixed(1)} mo`}
            hint={m.monthsOfRunway === null ? "needs a cash snapshot and a fixed cost" : "cash ÷ fixed cost"}
          />
        </section>

        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Spending through the month</h2>
            <span className="text-xs text-muted-foreground">grey: last month</span>
          </div>
          <SpendLine current={summary.dailySpend.current} previous={summary.dailySpend.previous} upToDay={isCurrent ? dayOf(now) : undefined} />
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">By category</h2>
            {summary.budgetCents !== null && (
              <span className={`text-xs tabular-nums ${budgetColor}`}>
                {formatBRL(m.expenseCents)} of {formatBRL(summary.budgetCents)} · {Math.round((budgetUsage ?? 0) * 100)}%
              </span>
            )}
          </div>
          {summary.budgetCents !== null && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round((budgetUsage ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget usage">
              <div
                className={`h-full rounded-full ${summary.budgetStatus === "over" ? "bg-red-500" : summary.budgetStatus === "risk" ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (budgetUsage ?? 0) * 100)}%` }}
              />
            </div>
          )}
          {summary.categories.length > 0 && (
            <div className="mb-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <Donut slices={summary.categories.map((c) => ({ name: c.name, cents: c.settledCents }))} label="Expense by category" centerLabel="settled" />
            </div>
          )}
          <CategoryTable lines={summary.categories} />
        </section>

        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-2 text-sm font-semibold">Last 6 months</h2>
          <BudgetBars months={summary.history} />
        </section>

        <section>
          <EntryList
            key={month}
            title="Still planned"
            initial={summary.planned}
            period={month}
            filters={{ status: "planned" }}
            lookups={buildLookups(accounts, categories)}
            today={now}
            infinite={false}
            emptyMessage="Nothing left to settle this month."
          />
        </section>
      </div>
    </>
  );
}
