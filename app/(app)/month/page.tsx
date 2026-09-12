import { EntryList } from "@/components/entries/entry-list";
import { buildLookups } from "@/components/entries/lookups";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryTable } from "@/components/month/category-table";
import { MonthPicker } from "@/components/month/month-picker";
import { Stat } from "@/components/month/stat";
import { isPeriod, periodOf, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { listAccounts } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { monthSummary } from "@/lib/services/summary";

export default async function MonthPage(props: PageProps<"/month">) {
  const sp = await props.searchParams;
  const now = today();
  const month = typeof sp.month === "string" && isPeriod(sp.month) ? sp.month : periodOf(now);

  const { userId, repos } = await getContext();
  const [summary, accounts, categories] = await Promise.all([
    monthSummary(repos, userId, month),
    listAccounts(repos, userId),
    listCategories(repos, userId),
  ]);
  const m = summary.metrics;

  return (
    <>
      <PageHeader title="Month" />
      <div className="space-y-6">
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

        <section>
          <h2 className="mb-2 text-sm font-semibold">By category</h2>
          <CategoryTable lines={summary.categories} />
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
