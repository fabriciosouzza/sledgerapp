"use client";

import { useActionState } from "react";
import type { AssetFormState } from "@/app/(app)/settings/assets/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { DatePicker } from "@/components/forms/date-picker";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ASSET_CLASSES } from "@/lib/domain/assets";
import type { Asset } from "@/lib/domain/types";

export function AssetForm({ asset, action, today }: { asset?: Asset; action: (prev: AssetFormState, formData: FormData) => Promise<AssetFormState>; today: string }) {
  const [state, dispatch] = useActionState(action, {});
  const v = state.values ?? {};
  const str = (key: string, fallback: string | null | undefined) => (typeof v[key] === "string" ? v[key] : (fallback ?? ""));

  return (
    <form action={dispatch} className="space-y-5">
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <FormError message={state.error} />
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={60} defaultValue={str("name", asset?.name)} className="h-11" autoFocus={!asset} />
      </Field>
      <Field label="Class" htmlFor="assetClass">
        <NativeSelect id="assetClass" name="assetClass" defaultValue={str("assetClass", asset?.assetClass) || "fixed_income"} className="w-full [&>select]:h-11">
          {ASSET_CLASSES.map((c) => (
            <NativeSelectOption key={c.value} value={c.value}>
              {c.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Subclass" htmlFor="subclass" hint="Optional. CDB, Tesouro, ETF…">
          <Input id="subclass" name="subclass" maxLength={60} defaultValue={str("subclass", asset?.subclass)} className="h-11" aria-describedby="subclass-hint" />
        </Field>
        <Field label="Broker" htmlFor="broker" hint="Optional.">
          <Input id="broker" name="broker" maxLength={60} defaultValue={str("broker", asset?.broker)} className="h-11" aria-describedby="broker-hint" />
        </Field>
      </div>
      {!asset && (
        <fieldset className="space-y-3 rounded-xl bg-muted/40 p-4">
          <legend className="px-1 text-sm font-medium">Already invested?</legend>
          <p className="text-xs text-muted-foreground">Start from where it stands. No cash entry is created — that money left your account long ago.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invested so far" htmlFor="openingContributedCents">
              <CurrencyInput id="openingContributedCents" name="openingContributedCents" className="h-11" />
            </Field>
            <Field label="Balance today" htmlFor="openingBalanceCents" hint="Blank = same as invested.">
              <CurrencyInput id="openingBalanceCents" name="openingBalanceCents" className="h-11" aria-describedby="openingBalanceCents-hint" />
            </Field>
          </div>
          <Field label="On" htmlFor="openingOn">
            <DatePicker id="openingOn" name="openingOn" defaultValue={today} />
          </Field>
        </fieldset>
      )}
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="isActive">Active</Label>
        <Switch id="isActive" name="isActive" defaultChecked={asset ? asset.isActive : true} />
      </div>
      <SubmitButton className="w-full" pendingText="Saving…">
        {asset ? "Save changes" : "Add asset"}
      </SubmitButton>
    </form>
  );
}
