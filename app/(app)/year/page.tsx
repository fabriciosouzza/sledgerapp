import { PageHeader } from "@/components/layout/page-header";
import { ViewSwitch, type YearRange } from "@/components/month/view-switch";
import { YearView } from "@/components/month/year-view";
import { addMonths, isPeriod, parsePeriod, periodOf, today, toPeriodString } from "@/lib/domain/dates";
import { getContext } from "@/lib/services/context";
import { yearSummary } from "@/lib/services/summary";

/** A calendar year or the last twelve months: totals, month by month, the budget month by month, the categories. The month itself is the home. */
export default async function YearPage(props: PageProps<"/year">) {
  const sp = await props.searchParams;
  const now = today();
  const current = periodOf(now);
  const month = typeof sp.month === "string" && isPeriod(sp.month) ? sp.month : current;
  const view: YearRange = sp.view === "rolling" ? "rolling" : "year";
  const { year } = parsePeriod(month);
  const hrefs = { year: `/year?month=${month}`, rolling: `/year?view=rolling&month=${month}` };

  const { userId, repos } = await getContext();
  // "12 months" is always the current month and the eleven before it.
  const from = view === "year" ? toPeriodString(year, 1) : addMonths(current, -11);
  const to = view === "year" ? toPeriodString(year, 12) : current;
  const summary = await yearSummary(repos, userId, from, to);

  return (
    <>
      <PageHeader title="Year" />
      <div className="space-y-6">
        <ViewSwitch view={view} hrefs={hrefs} />
        <YearView
          summary={summary}
          title={view === "year" ? String(year) : "Last 12 months"}
          prevHref={view === "year" ? `/year?month=${toPeriodString(year - 1, 1)}` : undefined}
          nextHref={view === "year" ? `/year?month=${toPeriodString(year + 1, 1)}` : undefined}
        />
      </div>
    </>
  );
}
