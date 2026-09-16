"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Asset, RecurrenceShare } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface Row {
  key: number;
  assetId: string;
  percent: string;
}

/**
 * The default split of a recurring contribution (PROMPT.md §5.5): whole
 * percentages per asset that must total 100, or nothing at all. Submits
 * `split:<assetId>` fields; the parent form owns the submit.
 */
export function SplitFields({ assets, initial }: { assets: Asset[]; initial: RecurrenceShare[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((s, i) => ({ key: i, assetId: s.assetId, percent: String(s.sharePercent) })));
  const [nextKey, setNextKey] = useState(rows.length);
  const total = rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const unused = assets.filter((a) => !rows.some((r) => r.assetId === a.id));

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function add() {
    if (unused.length === 0) return;
    setRows((prev) => [...prev, { key: nextKey, assetId: unused[0].id, percent: String(Math.max(0, 100 - total)) }]);
    setNextKey((k) => k + 1);
  }

  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">No asset yet. Add one in Settings → Assets and the split can be set here.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2 text-sm font-medium" aria-hidden>
          <span>Asset</span>
          <span>Share</span>
          <span className="w-11" />
        </div>
      )}
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-2">
          <div>
            <NativeSelect value={row.assetId} onChange={(e) => update(row.key, { assetId: e.target.value })} aria-label="Asset" className="w-full [&>select]:h-11">
              {assets
                .filter((a) => a.id === row.assetId || !rows.some((r) => r.assetId === a.id))
                .map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
          <div>
            <div className="relative">
              <Input
                name={`split:${row.assetId}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={row.percent}
                onChange={(e) => update(row.key, { percent: e.target.value })}
                aria-label="Share in percent"
                className="h-11 pr-7"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground" aria-hidden>
                %
              </span>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-lg" className="size-11" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))} aria-label="Remove this asset">
            <X aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className={cn("text-sm tabular-nums", rows.length > 0 && total !== 100 ? "text-caution" : "text-muted-foreground")} aria-live="polite">
          {rows.length === 0 ? "No default: each month asks where it goes." : total === 100 ? "100% · adds up" : `${total}% · needs 100%`}
        </p>
        {unused.length > 0 && (
          <Button type="button" variant="outline" className="h-11" onClick={add}>
            <Plus data-icon="inline-start" aria-hidden />
            {rows.length === 0 ? "Set a default split" : "Another asset"}
          </Button>
        )}
      </div>
    </div>
  );
}
