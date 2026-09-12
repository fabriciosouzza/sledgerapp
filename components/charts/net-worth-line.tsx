"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeriodShort } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { NetWorthPoint } from "@/lib/domain/netWorth";

/** Net worth over time. Months without a snapshot are gaps, never zero (§5.9). */
export function NetWorthLine({ data, height = 192, compact = false }: { data: NetWorthPoint[]; height?: number; compact?: boolean }) {
  const rows = data.map((p) => ({ period: formatPeriodShort(p.period), value: p.netWorthCents === null ? null : p.netWorthCents / 100 }));
  const known = rows.filter((r) => r.value !== null);
  if (known.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No snapshots yet: the chart starts with the first one.</p>;
  }
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Net worth over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {!compact && <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />}
          <YAxis hide domain={["auto", "auto"]} />
          {!compact && (
            <Tooltip
              formatter={(v) => [formatBRL(Math.round(Number(v) * 100)), "Net worth"]}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
            />
          )}
          <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={!compact || known.length === 1} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
