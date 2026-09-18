"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeriodShort } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { NetWorthPoint } from "@/lib/domain/netWorth";

/** Net worth over time. Months before the first account are gaps, never zero. */
export function NetWorthLine({ data, height = 192 }: { data: NetWorthPoint[]; height?: number }) {
  const rows = data.map((p) => ({ period: formatPeriodShort(p.period), value: p.netWorthCents === null ? null : p.netWorthCents / 100 }));
  const known = rows.filter((r) => r.value !== null);
  if (known.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing to chart yet: add a cash account with its starting balance.</p>;
  }
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Net worth over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v) => [formatBRL(Math.round(Number(v) * 100)), "Net worth"]}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
