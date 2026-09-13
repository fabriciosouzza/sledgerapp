"use client";

import { useActionState, useState } from "react";
import type { AccountFormState } from "@/app/(app)/settings/accounts/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { DatePicker } from "@/components/forms/date-picker";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ACCOUNT_TYPES, isCashAccount } from "@/lib/domain/accounts";
import type { Account, AccountType } from "@/lib/domain/types";

export function AccountForm({
  account,
  action,
  today,
}: {
  account?: Account;
  action: (prev: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  today: string;
}) {
  const [state, dispatch] = useActionState(action, {});
  const v = state.values ?? {};
  const str = (key: string, fallback: string | number | null | undefined) =>
    typeof v[key] === "string" ? v[key] : fallback === null || fallback === undefined ? "" : String(fallback);

  const [type, setType] = useState<AccountType>((str("type", account?.type) || "checking") as AccountType);
  const isCard = type === "credit_card";
  const isCash = isCashAccount({ type });

  return (
    <form action={dispatch} className="space-y-5">
      {account && <input type="hidden" name="id" value={account.id} />}
      <FormError message={state.error} />

      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={60} defaultValue={str("name", account?.name)} className="h-11" autoFocus={!account} />
      </Field>

      <Field label="Type" htmlFor="type">
        <NativeSelect id="type" name="type" value={type} onChange={(e) => setType(e.target.value as AccountType)} className="w-full [&>select]:h-11">
          {ACCOUNT_TYPES.map((t) => (
            <NativeSelectOption key={t.value} value={t.value}>
              {t.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Institution" htmlFor="institution" hint="Optional. Bank, broker or issuer.">
        <Input id="institution" name="institution" maxLength={60} defaultValue={str("institution", account?.institution)} className="h-11" aria-describedby="institution-hint" />
      </Field>

      {isCard && (
        <fieldset className="space-y-4 rounded-xl bg-muted/40 p-4">
          <legend className="px-1 text-sm font-medium">Card cycle</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Closing day" htmlFor="closingDay">
              <Input id="closingDay" name="closingDay" type="number" inputMode="numeric" min={1} max={31} required defaultValue={str("closingDay", account?.closingDay)} className="h-11" />
            </Field>
            <Field label="Due day" htmlFor="dueDay">
              <Input id="dueDay" name="dueDay" type="number" inputMode="numeric" min={1} max={31} required defaultValue={str("dueDay", account?.dueDay)} className="h-11" />
            </Field>
          </div>
          <Field label="Credit limit" htmlFor="creditLimitCents" hint="Optional.">
            <CurrencyInput id="creditLimitCents" name="creditLimitCents" defaultCents={account?.creditLimitCents ?? null} className="h-11" aria-describedby="creditLimitCents-hint" />
          </Field>
        </fieldset>
      )}

      {isCash && (
        <fieldset className="space-y-4 rounded-xl bg-muted/40 p-4">
          <legend className="px-1 text-sm font-medium">Starting point</legend>
          <p className="text-xs text-muted-foreground">The balance at the start of that day, before anything you record for it. Every settled entry from then on moves it.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Balance" htmlFor="openingBalanceCents">
              <CurrencyInput id="openingBalanceCents" name="openingBalanceCents" defaultCents={account?.openingBalanceCents ?? 0} className="h-11" />
            </Field>
            <Field label="On" htmlFor="openingOn">
              <DatePicker id="openingOn" name="openingOn" defaultValue={account?.openingOn ?? today} required />
            </Field>
          </div>
        </fieldset>
      )}

      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="isActive">Active</Label>
        <Switch id="isActive" name="isActive" defaultChecked={account ? account.isActive : true} />
      </div>

      <SubmitButton className="w-full" pendingText="Saving…">
        {account ? "Save changes" : "Add account"}
      </SubmitButton>
    </form>
  );
}
