"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addMovementAction } from "@/app/(app)/portfolio/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/forms/date-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MOVEMENT_KINDS } from "@/lib/domain/assets";
import type { Account, Asset, MovementKind } from "@/lib/domain/types";

export function MovementForm({
  assets,
  accounts,
  today,
  defaultAssetId,
}: {
  assets: Asset[];
  accounts: Account[];
  today: string;
  defaultAssetId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState<MovementKind>("contribution");
  const [negative, setNegative] = useState(false);
  const [pair, setPair] = useState(true);
  const [cents, setCents] = useState<number | null>(null);

  const cash = accounts.filter((a) => a.type !== "brokerage" && a.type !== "credit_card");
  const brokerages = accounts.filter((a) => a.type === "brokerage");
  const canPair = kind === "contribution" && cash.length > 0 && brokerages.length > 0;
  const hint = MOVEMENT_KINDS.find((k) => k.value === kind)?.hint;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (kind === "market_adjustment" && negative && cents) formData.set("amountCents", `-${formData.get("amountCents")}`);
    if (!(canPair && pair)) {
      formData.delete("fromAccountId");
      formData.delete("brokerageAccountId");
    }
    setError(undefined);
    startTransition(async () => {
      const result = await addMovementAction(formData);
      if (!result.ok) return setError(result.error);
      toast.success("Movement saved");
      router.push(`/portfolio/${result.assetId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />

      <Field label="Asset" htmlFor="assetId">
        <NativeSelect id="assetId" name="assetId" defaultValue={defaultAssetId ?? assets[0]?.id} required className="w-full [&>select]:h-11">
          {assets.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Kind" htmlFor="kind" hint={hint}>
        <NativeSelect id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as MovementKind)} className="w-full [&>select]:h-11" aria-describedby="kind-hint">
          {MOVEMENT_KINDS.map((k) => (
            <NativeSelectOption key={k.value} value={k.value}>
              {k.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="amountCents">
          <CurrencyInput id="amountCents" name="amountCents" required autoFocus onCentsChange={setCents} className="h-11" />
        </Field>
        <Field label="Date" htmlFor="date">
          <DatePicker id="date" name="date" required defaultValue={today} />
        </Field>
      </div>

      {kind === "market_adjustment" && (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <Label htmlFor="negative">Loss</Label>
            <p className="text-xs text-muted-foreground">The balance went down.</p>
          </div>
          <Switch id="negative" checked={negative} onCheckedChange={setNegative} />
        </div>
      )}

      {kind === "contribution" && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-4">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div>
              <Label htmlFor="pair">Record the cash entry</Label>
              <p className="text-xs text-muted-foreground">A contribution entry from your cash account to the brokerage.</p>
            </div>
            <Switch id="pair" checked={canPair && pair} onCheckedChange={setPair} disabled={!canPair} />
          </div>
          {canPair && pair && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="fromAccountId">
                <NativeSelect id="fromAccountId" name="fromAccountId" defaultValue={cash[0]?.id} className="w-full [&>select]:h-11">
                  {cash.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="To brokerage" htmlFor="brokerageAccountId">
                <NativeSelect id="brokerageAccountId" name="brokerageAccountId" defaultValue={brokerages[0]?.id} className="w-full [&>select]:h-11">
                  {brokerages.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
        </div>
      )}

      <Field label="Notes" htmlFor="notes" hint="Optional.">
        <Textarea id="notes" name="notes" rows={2} maxLength={500} aria-describedby="notes-hint" />
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Saving…" : "Save movement"}
      </Button>
    </form>
  );
}
