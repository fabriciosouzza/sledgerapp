"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeriodShort } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { BudgetMonth } from "@/lib/services/summary";

type Status = "within" | "risk" | "over" | "none";
const COLOR: Record<Status, string> = { within: "var(--chart-1)", risk: "#f59e0b", over: "#ef4444", none: "var(--muted-foreground)" };

/** Spend per month against the caps budget: within / at risk / over (DESIGN.md §5). */
export function BudgetBars({ months }: { months: BudgetMonth[] }) {
  const rows = months.map((m) => ({ period: formatPeriodShort(m.period), spent: m.expenseCents / 100, status: (m.status ?? "none") as Status }));
  const budget = months[0]?.budgetCents;
  return (
    <div className="space-y-2">
      <div className="h-40 w-full" role="img" aria-label="Spending per month against the budget">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              formatter={(v) => [formatBRL(Math.round(Number(v) * 100)), "Spent"]}
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
            />
            {budget ? <ReferenceLine y={budget / 100} stroke="var(--muted-foreground)" strokeDasharray="3 3" /> : null}
            <Bar dataKey="spent" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.period} fill={COLOR[r.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {budget ? (
        <ul className="flex gap-4 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: COLOR.within }} aria-hidden /> within</li>
          <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: COLOR.risk }} aria-hidden /> at risk</li>
          <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: COLOR.over }} aria-hidden /> over</li>
          <li className="ml-auto">dashed: budget {formatBRL(budget)}</li>
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">Set caps on categories to get a budget line.</p>
      )}
    </div>
  );
}
