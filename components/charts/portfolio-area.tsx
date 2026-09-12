"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPeriodShort } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { PortfolioPoint } from "@/lib/domain/portfolio";

/** Contributed vs earned over time, stacked (§7 /portfolio). */
export function PortfolioArea({ data }: { data: PortfolioPoint[] }) {
  const rows = data.map((p) => ({
    period: formatPeriodShort(p.period),
    contributed: p.contributedCents / 100,
    earned: p.earnedCents / 100,
  }));
  return (
    <div className="space-y-1">
      <div
        className="h-48 w-full"
        role="img"
        aria-label="Contributed versus earned over time"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="period"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v, name) => [
                formatBRL(Math.round(Number(v) * 100)),
                name === "contributed" ? "Contributed" : "Earned",
              ]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="contributed"
              stackId="1"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="earned"
              stackId="1"
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex gap-4 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1">
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--chart-2)" }}
            aria-hidden
          />{" "}
          contributed
        </li>
        <li className="flex items-center gap-1">
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--chart-1)" }}
            aria-hidden
          />{" "}
          earned (stacked on top)
        </li>
      </ul>
    </div>
  );
}
