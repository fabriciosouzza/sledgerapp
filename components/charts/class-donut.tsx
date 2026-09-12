"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { assetClassLabel } from "@/lib/domain/assets";
import { formatBRL } from "@/lib/domain/money";
import type { AssetClass } from "@/lib/domain/types";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

export function ClassDonut({ data }: { data: { assetClass: AssetClass; balanceCents: number }[] }) {
  const total = data.reduce((s, d) => s + d.balanceCents, 0);
  const rows = data.map((d) => ({ name: assetClassLabel(d.assetClass), value: d.balanceCents }));
  return (
    <div className="flex items-center gap-4">
      <div className="h-36 w-36 shrink-0" role="img" aria-label="Balance by asset class">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {rows.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{total > 0 ? `${Math.round((r.value / total) * 100)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
