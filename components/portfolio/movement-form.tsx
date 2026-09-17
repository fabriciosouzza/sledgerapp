"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addMovementAction, updateMovementAction } from "@/app/(app)/portfolio/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/forms/date-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLocalMemory } from "@/lib/client/local-memory";
import { assetLabel, MOVEMENT_KINDS, movementKindLabel } from "@/lib/domain/assets";
import { formatBRL } from "@/lib/domain/money";
import type { Account, Asset, AssetMovement, MovementKind } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { accountLabel } from "@/lib/domain/accounts";

const KIND_MEMORY = "sledger.lastMovementKind";

/** The signed amount as the schemas read it (`-1.234,56`). */
function toField(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, "0")}`;
}

interface SessionRow {
  id: string;
  assetId: string;
  assetName: string;
  kind: MovementKind;
  amountCents: number;
}

export function MovementForm({
  assets,
  accounts,
  balances,
  today,
  defaultAssetId,
  movement,
}: {
  assets: Asset[];
  accounts: Account[];
  /** Recorded balance per asset, so an adjustment can be typed as the broker's balance. */
  balances: Record<string, number>;
  today: string;
  defaultAssetId?: string;
  /** Present when editing. */
  movement?: AssetMovement;
}) {
  const editing = movement !== undefined;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const [assetId, setAssetId] = useState(movement?.assetId ?? defaultAssetId ?? assets[0]?.id ?? "");
  const [kindChoice, setKindChoice] = useState<MovementKind | null>(movement?.kind ?? null);
  const [negative, setNegative] = useState((movement?.amountCents ?? 0) < 0);
  const [byBalance, setByBalance] = useState(!editing);
  // On by default once the asset has history; a first movement is usually the balance already held.
  const [pairChoice, setPairChoice] = useState<boolean | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [added, setAdded] = useState<SessionRow[]>([]);

  // The last kind recorded for each asset is usually the next one (monthly yield, say).
  const [lastKinds, rememberKind] = useLocalMemory<Record<string, MovementKind>>(KIND_MEMORY, {});
  const kind: MovementKind = kindChoice ?? (editing ? "contribution" : (lastKinds[assetId] ?? "contribution"));

  const cash = accounts.filter((a) => a.type !== "credit_card");
  const hasHistory = assetId in balances;
  const canPair = (kind === "contribution" || kind === "withdrawal") && cash.length > 0;
  const pair = pairChoice ?? (hasHistory || kind === "withdrawal");
  const hint = MOVEMENT_KINDS.find((k) => k.value === kind)?.hint;
  const recorded = balances[assetId] ?? 0;
  const adjustment = kind === "market_adjustment" ? (byBalance ? (cents === null ? null : cents - recorded) : cents === null ? null : negative ? -cents : cents) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (kind === "market_adjustment") {
      if (adjustment === null || adjustment === 0) return setError(byBalance ? "The broker balance equals what is recorded: nothing to adjust." : "Enter an amount.");
      formData.set("amountCents", toField(adjustment));
    }
    if (!(canPair && pair)) formData.delete("cashAccountId");
    setError(undefined);
    startTransition(async () => {
      const result = editing ? await updateMovementAction(formData) : await addMovementAction(formData);
      if (!result.ok) return setError(result.error);
      if (editing) {
        toast.success("Movement saved");
        router.push(`/portfolio/${result.assetId}`);
        return;
      }
      rememberKind((m) => ({ ...m, [assetId]: kind }));
      const asset = assets.find((a) => a.id === assetId);
      setAdded((prev) => [{ id: result.id, assetId, assetName: asset?.name ?? "", kind, amountCents: adjustment ?? cents ?? 0 }, ...prev]);
      toast.success(`${movementKindLabel(kind)} saved · ${asset?.name ?? ""}`);
      // Recording a round for every asset: move on to the next one, same kind.
      const index = assets.findIndex((a) => a.id === assetId);
      const next = assets[index + 1];
      if (next) setAssetId(next.id);
      setKindChoice(kind);
      setCents(null);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />
      {movement && <input type="hidden" name="id" value={movement.id} />}

      <Field label="Asset" htmlFor="assetId" hint={editing ? undefined : `Recorded balance ${formatBRL(recorded)}`}>
        <NativeSelect id="assetId" name="assetId" value={assetId} onChange={(e) => setAssetId(e.target.value)} required disabled={editing} className="w-full [&>select]:h-11" aria-describedby="assetId-hint">
          {assets.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {assetLabel(a)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Kind" htmlFor="kind" hint={hint}>
        <NativeSelect id="kind" name="kind" value={kind} onChange={(e) => setKindChoice(e.target.value as MovementKind)} disabled={editing && movement.entryId !== null} className="w-full [&>select]:h-11" aria-describedby="kind-hint">
          {MOVEMENT_KINDS.map((k) => (
            <NativeSelectOption key={k.value} value={k.value}>
              {k.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      {kind === "market_adjustment" && (
        <div role="radiogroup" aria-label="How to enter the adjustment" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              [true, "Balance at the broker"],
              [false, "Difference"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={byBalance === value}
              onClick={() => setByBalance(value)}
              className={cn(
                "h-9 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                byBalance === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={kind === "market_adjustment" && byBalance ? "Balance at the broker" : "Amount"} htmlFor="amountCents">
          <CurrencyInput
            id="amountCents"
            name={kind === "market_adjustment" && byBalance ? "brokerBalance" : "amountCents"}
            required
            autoFocus
            defaultCents={movement ? Math.abs(movement.amountCents) : null}
            onCentsChange={setCents}
            className="h-11"
          />
        </Field>
        <Field label="Date" htmlFor="date">
          <DatePicker id="date" name="date" required defaultValue={movement?.date ?? today} />
        </Field>
      </div>

      {kind === "market_adjustment" && byBalance && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {adjustment === null
            ? `Recorded ${formatBRL(recorded)}. Type what the broker shows; the difference is the adjustment.`
            : adjustment === 0
              ? "Same as recorded: nothing to adjust."
              : `Adjustment ${adjustment > 0 ? "+" : "−"}${formatBRL(Math.abs(adjustment))} (${formatBRL(recorded)} → ${formatBRL(recorded + adjustment)})`}
        </p>
      )}

      {kind === "market_adjustment" && !byBalance && (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <Label htmlFor="negative">Loss</Label>
            <p className="text-xs text-muted-foreground">The balance went down.</p>
          </div>
          <Switch id="negative" checked={negative} onCheckedChange={setNegative} />
        </div>
      )}

      {(kind === "contribution" || kind === "withdrawal") && !editing && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-4">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div>
              <Label htmlFor="pair">Record the cash entry</Label>
              <p className="text-xs text-muted-foreground">
                {kind === "contribution"
                  ? hasHistory
                    ? "A contribution entry leaving your cash account, paired with this movement."
                    : "First movement of this asset. Leave it off if this is a balance you already hold — that money left the bank long ago."
                  : "A redemption entry reaching your cash account, paired with this movement."}
              </p>
            </div>
            <Switch id="pair" checked={canPair && pair} onCheckedChange={setPairChoice} disabled={!canPair} />
          </div>
          {canPair && pair && (
            <Field label={kind === "contribution" ? "From" : "To"} htmlFor="cashAccountId">
              <NativeSelect id="cashAccountId" name="cashAccountId" defaultValue={cash[0]?.id} className="w-full [&>select]:h-11">
                {cash.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
      )}

      <Field label="Notes" htmlFor="notes" hint="Optional.">
        <Textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={movement?.notes ?? ""} aria-describedby="notes-hint" />
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Save movement"}
      </Button>

      {added.length > 0 && (
        <section aria-label="Added now" className="rounded-xl bg-muted/40 p-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted-foreground">Added now · {added.length}</h2>
            <Link href="/portfolio" className="text-xs underline-offset-4 hover:underline">
              Done → portfolio
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {added.map((row) => (
              <li key={row.id}>
                <Link href={`/portfolio/movements/${row.id}`} className="flex min-h-10 items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {row.assetName} <span className="text-muted-foreground">· {movementKindLabel(row.kind)}</span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", row.amountCents < 0 && "text-negative")}>{formatBRL(row.amountCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
