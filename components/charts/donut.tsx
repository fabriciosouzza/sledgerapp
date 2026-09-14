"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRL, formatBRLWhole } from "@/lib/domain/money";

/** Six greys, strongest for the largest slice, each at least 3:1 against the card in both themes (`--donut-*` in globals.css). */
const TONES = ["var(--donut-1)", "var(--donut-2)", "var(--donut-3)", "var(--donut-4)", "var(--donut-5)", "var(--donut-6)"];
/** Slices at least this big carry their share on the ring itself. */
const LABEL_MIN_SHARE = 0.1;

export interface DonutSlice {
  name: string;
  cents: number;
  color?: string;
}

interface SliceLabelProps {
  cx?: unknown;
  cy?: unknown;
  midAngle?: unknown;
  innerRadius?: unknown;
  outerRadius?: unknown;
  percent?: unknown;
}

function SliceLabel(props: SliceLabelProps) {
  const percent = Number(props.percent ?? 0);
  if (percent < LABEL_MIN_SHARE) return null;
  const radius = (Number(props.innerRadius) + Number(props.outerRadius)) / 2;
  const angle = (-Number(props.midAngle) * Math.PI) / 180;
  return (
    <text x={Number(props.cx) + radius * Math.cos(angle)} y={Number(props.cy) + radius * Math.sin(angle)} textAnchor="middle" dominantBaseline="central" fill="var(--card)" fontSize={10} fontWeight={600}>
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

/** Share of a total by slice, with the total in the middle and a legend beside it. */
export function Donut({ slices, label, centerLabel }: { slices: DonutSlice[]; label: string; centerLabel?: string }) {
  const total = slices.reduce((s, d) => s + d.cents, 0);
  // Largest first: shade follows size, and the legend reads in the ring's order.
  const rows = slices
    .filter((d) => d.cents > 0)
    .sort((a, b) => b.cents - a.cents)
    .map((d, i) => ({ ...d, fill: d.color ?? TONES[Math.min(i, TONES.length - 1)] }));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[144px] w-[144px] shrink-0" role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${total > 0 ? Math.round((r.cents / total) * 100) : 0}%`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="cents" nameKey="name" innerRadius={44} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive={false} label={SliceLabel} labelLine={false}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold tabular-nums">{formatBRLWhole(total)}</span>
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="min-w-[8rem] flex-1 space-y-1 text-xs">
        {rows.slice(0, 6).map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.fill }} aria-hidden />
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
