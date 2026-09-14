"use client";

import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeriodShort } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { BudgetMonth } from "@/lib/services/summary";

type Status = "within" | "risk" | "over" | "none";
/** Neutral while within; colour only once a month is at risk or over. Each bar also carries its % in text. */
const COLOR: Record<Status, string> = { within: "var(--chart-2)", risk: "var(--caution)", over: "var(--negative)", none: "var(--muted-foreground)" };
const WORD: Record<Status, string> = { within: "within", risk: "at risk", over: "over", none: "no budget" };

/** Spending in capped categories per month against the caps budget: within / at risk / over (DESIGN.md §5). */
export function BudgetBars({ months }: { months: BudgetMonth[] }) {
  const budget = months[0]?.budgetCents ?? null;
  // Without caps there is nothing to measure against: show the month's spending, uncoloured.
  const rows = months.map((m) => ({
    period: formatPeriodShort(m.period),
    spent: (budget ? m.spentCents : m.expenseCents) / 100,
    status: (m.status ?? "none") as Status,
    pct: budget ? Math.round((m.spentCents / budget) * 100) : null,
  }));
  const description = budget
    ? `Spending in categories with a cap, per month, against the budget of ${formatBRL(budget)}: ${rows.map((r) => `${r.period} ${r.pct}% ${WORD[r.status]}`).join(", ")}`
    : "Spending per month; no category has a cap yet";
  return (
    <div className="space-y-2">
      <div className="h-40 w-full" role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              formatter={(v) => [formatBRL(Math.round(Number(v) * 100)), budget ? "Spent with a cap" : "Spent"]}
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
            />
            {budget ? <ReferenceLine y={budget / 100} stroke="var(--muted-foreground)" strokeDasharray="3 3" /> : null}
            <Bar dataKey="spent" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.period} fill={COLOR[r.status]} />
              ))}
              {budget ? <LabelList dataKey="pct" position="top" formatter={(v) => (typeof v === "number" ? `${v}%` : "")} fontSize={11} fill="var(--muted-foreground)" /> : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {budget ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(["within", "risk", "over"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: COLOR[s] }} aria-hidden /> {WORD[s]}
            </li>
          ))}
          <li className="ml-auto">dashed: budget {formatBRL(budget)}</li>
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Set caps on categories to get a budget line.</p>
      )}
    </div>
  );
}
