"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { allocationTotal } from "@/lib/domain/allocation";
import { assetLabel } from "@/lib/domain/assets";
import { formatBRL } from "@/lib/domain/money";
import type { AllocationLine, Asset } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface Row {
  key: number;
  assetId: string;
  cents: number | null;
}

/**
 * Where a contribution goes (PROMPT.md §5.2): one row per asset with its
 * amount, and a running "still to place" so the parts are made to add up
 * before Save. Submits `allocation:<assetId>` fields the schemas lift into
 * an allocation; the parent form owns the submit.
 */
export function AllocationFields({
  assets,
  totalCents,
  initial,
  verb = "goes to",
}: {
  assets: Asset[];
  /** The entry's amount; `null` while it is still being typed. */
  totalCents: number | null;
  initial?: AllocationLine[];
  /** "goes to" for a contribution, "comes from" for a redemption. */
  verb?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    const lines = initial && initial.length > 0 ? initial : assets.length > 0 ? [{ assetId: assets[0].id, amountCents: totalCents ?? 0 }] : [];
    return lines.map((l, i) => ({ key: i, assetId: l.assetId, cents: l.amountCents > 0 ? l.amountCents : null }));
  });
  const [nextKey, setNextKey] = useState(rows.length);
  // Each row re-mounts when its amount is filled in by a shortcut, so the mask shows the new value.
  const [bump, setBump] = useState(0);
  // Untouched with a single row, the whole amount goes there and follows it as it is typed: one asset needs no extra typing.
  const [auto, setAuto] = useState(!(initial && initial.length > 0));
  const following = auto && rows.length === 1;
  const shown = following ? rows.map((r) => ({ ...r, cents: totalCents })) : rows;

  const placed = allocationTotal(shown.map((r) => ({ amountCents: r.cents ?? 0 })));
  const left = totalCents === null ? null : totalCents - placed;
  const unused = assets.filter((a) => !rows.some((r) => r.assetId === a.id));

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function typed(key: number, cents: number | null) {
    setAuto(false);
    update(key, { cents });
  }
  function remove(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }
  function add() {
    if (unused.length === 0) return;
    // The first row stops following the total: from here on the split is the user's.
    if (following) setRows(shown);
    setAuto(false);
    setRows((prev) => [...prev, { key: nextKey, assetId: unused[0].id, cents: null }]);
    setNextKey((k) => k + 1);
    setBump((b) => b + 1);
  }
  function fillRest(key: number) {
    if (left === null) return;
    const row = shown.find((r) => r.key === key);
    if (!row) return;
    setAuto(false);
    update(key, { cents: (row.cents ?? 0) + left });
    setBump((b) => b + 1);
  }

  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">No asset to put it in yet. Add one in Settings → Assets first.</p>;
  }

  return (
    <div className="space-y-2" role="group" aria-label={`Which assets it ${verb}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-sm font-medium" aria-hidden>
        <span>Asset</span>
        <span>Amount</span>
        <span className="w-11" />
      </div>
      {shown.map((row) => (
        <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
          <div>
            <NativeSelect value={row.assetId} onChange={(e) => update(row.key, { assetId: e.target.value })} aria-label="Asset" className="w-full [&>select]:h-11">
              {assets
                .filter((a) => a.id === row.assetId || !rows.some((r) => r.assetId === a.id))
                .map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {assetLabel(a)}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
          <div>
            <CurrencyInput
              key={`${row.key}-${bump}-${following ? row.cents ?? 0 : "typed"}`}
              name={`allocation:${row.assetId}`}
              defaultCents={row.cents}
              onCentsChange={(cents) => typed(row.key, cents)}
              className="h-11"
              aria-describedby="allocation-left"
            />
          </div>
          <div className="flex min-w-11 justify-end gap-1">
            {left !== null && left > 0 && (
              <Button type="button" variant="ghost" className="h-11 px-2 text-xs" onClick={() => fillRest(row.key)} aria-label={`Put the remaining ${formatBRL(left)} here`}>
                Rest
              </Button>
            )}
            {rows.length > 1 && (
              <Button type="button" variant="ghost" size="icon-lg" className="size-11" onClick={() => remove(row.key)} aria-label="Remove this asset">
                <X aria-hidden />
              </Button>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p id="allocation-left" className={cn("text-sm tabular-nums", left !== null && left !== 0 ? "text-caution" : "text-muted-foreground")} aria-live="polite">
          {totalCents === null || left === null
            ? "Type the amount first."
            : left === 0
              ? `${formatBRL(placed)} placed · adds up`
              : left > 0
                ? `${formatBRL(placed)} of ${formatBRL(totalCents)} placed · ${formatBRL(left)} still to place`
                : `${formatBRL(-left)} over the amount`}
        </p>
        {unused.length > 0 && (
          <Button type="button" variant="outline" className="h-11" onClick={add}>
            <Plus data-icon="inline-start" aria-hidden />
            Another asset
          </Button>
        )}
      </div>
    </div>
  );
}
