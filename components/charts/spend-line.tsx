"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/domain/money";

/** Cumulative settled expense through the month, with last month faded behind (DESIGN.md §4). */
export function SpendLine({ current, previous, upToDay }: { current: number[]; previous: number[]; upToDay?: number }) {
  const days = Math.max(current.length, previous.length);
  const rows = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    current: upToDay !== undefined && i + 1 > upToDay ? null : (current[i] ?? null) === null ? null : current[i] / 100,
    previous: previous[i] === undefined ? null : previous[i] / 100,
  }));
  if (current.every((v) => v === 0) && previous.every((v) => v === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No settled expenses yet.</p>;
  }
  return (
    <div className="h-40 w-full" role="img" aria-label="Spending through the month">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} ticks={[1, 8, 15, 22, days]} />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            formatter={(v, name) => [formatBRL(Math.round(Number(v) * 100)), name === "current" ? "This month" : "Last month"]}
            labelFormatter={(d) => `Day ${d}`}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="previous" stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="current" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
