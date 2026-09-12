"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRL, formatBRLWhole } from "@/lib/domain/money";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

export interface DonutSlice {
  name: string;
  cents: number;
  color?: string;
}

/** Share of a total by slice, with the total in the middle and a legend beside it. */
export function Donut({ slices, label, centerLabel }: { slices: DonutSlice[]; label: string; centerLabel?: string }) {
  const total = slices.reduce((s, d) => s + d.cents, 0);
  const rows = slices.filter((d) => d.cents > 0).map((d, i) => ({ ...d, fill: d.color ?? COLORS[i % COLORS.length] }));
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="cents" nameKey="name" innerRadius={44} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold tabular-nums">{formatBRLWhole(total)}</span>
          {centerLabel && <span className="text-[10px] text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {rows.slice(0, 6).map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: r.fill }} aria-hidden />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{total > 0 ? `${Math.round((r.cents / total) * 100)}%` : "—"}</span>
          </li>
        ))}
        {rows.length > 6 && <li className="text-muted-foreground">+{rows.length - 6} more</li>}
      </ul>
    </div>
  );
}
