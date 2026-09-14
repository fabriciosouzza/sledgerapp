"use client";

import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeriodShort } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { YearMonth } from "@/lib/services/summary";

/** Income, expense and contributions per month with the savings rate as a line (DESIGN.md §4). */
export function YearBars({ months }: { months: YearMonth[] }) {
  const all = months.map((m) => ({
    period: formatPeriodShort(m.period),
    income: m.metrics.incomeCents / 100,
    expense: m.metrics.expenseCents / 100,
    contributions: m.metrics.contributionsCents / 100,
    rate: m.metrics.savingsRate === null ? null : Math.round(m.metrics.savingsRate * 100),
  }));
  // A year in progress ends at its last month with anything in it, not in empty months to come.
  let last = all.length - 1;
  while (last > 0 && all[last].income === 0 && all[last].expense === 0 && all[last].contributions === 0) last -= 1;
  const rows = all.slice(0, last + 1);
  if (rows.every((r) => r.income === 0 && r.expense === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing settled in this range.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="h-52 w-full" role="img" aria-label="Income, expense and contributions per month">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={1} tickFormatter={(v: string) => v.slice(0, 3)} />
            <YAxis yAxisId="money" hide domain={[0, "auto"]} />
            <YAxis yAxisId="rate" hide domain={[(min: number) => Math.min(-100, Math.floor(min / 50) * 50), 100]} />
            <Tooltip
              formatter={(v, name) =>
                name === "rate" ? [v === null ? "—" : `${v}%`, "Savings rate"] : [formatBRL(Math.round(Number(v) * 100)), String(name)[0].toUpperCase() + String(name).slice(1)]
              }
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
            />
            <Bar yAxisId="money" dataKey="income" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="money" dataKey="expense" fill="var(--chart-2)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            {/* Outlined, so contributions differ from expense by shape, not only by shade. */}
            <Bar yAxisId="money" dataKey="contributions" fill="transparent" stroke="var(--chart-2)" strokeWidth={1.5} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} aria-hidden /> income</li>
        <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} aria-hidden /> expense</li>
        <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ boxShadow: "inset 0 0 0 1.5px var(--chart-2)" }} aria-hidden /> contributions</li>
        <li className="flex items-center gap-1"><span className="h-0.5 w-3 bg-muted-foreground" aria-hidden /> savings rate</li>
      </ul>
    </div>
  );
}
