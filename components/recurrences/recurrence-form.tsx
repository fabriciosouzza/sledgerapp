"use client";

import { useActionState, useState } from "react";
import type { RecurrenceFormState } from "@/app/(app)/recurrences/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { appliesToKind } from "@/lib/domain/categories";
import { ENTRY_KINDS, needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import type { Account, Category, EntryKind, Recurrence } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function RecurrenceForm({
  recurrence,
  accounts,
  categories,
  today,
  action,
}: {
  recurrence?: Recurrence;
  accounts: Account[];
  categories: Category[];
  today: string;
  action: (prev: RecurrenceFormState, formData: FormData) => Promise<RecurrenceFormState>;
}) {
  const [state, dispatch] = useActionState(action, {});
  const v = state.values ?? {};
  const str = (key: string, fallback: string | number | null | undefined) =>
    typeof v[key] === "string" ? v[key] : fallback === null || fallback === undefined ? "" : String(fallback);

  const [kind, setKind] = useState<EntryKind>((str("kind", recurrence?.kind) || "expense") as EntryKind);
  const [accountId, setAccountId] = useState(str("accountId", recurrence?.accountId) || accounts[0]?.id || "");
  const kindCategories = categories.filter((c) => appliesToKind(c, kind));
  const counterOptions = accounts.filter((a) => a.id !== accountId && (kind !== "contribution" || a.type === "brokerage"));

  return (
    <form action={dispatch} className="space-y-5">
      {recurrence && <input type="hidden" name="id" value={recurrence.id} />}
      <input type="hidden" name="kind" value={kind} />
      <FormError message={state.error} />

      <div role="radiogroup" aria-label="Kind" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {ENTRY_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              "h-10 rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:text-sm",
              kind === k.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Field label="Description" htmlFor="description">
        <Input id="description" name="description" required maxLength={120} defaultValue={str("description", recurrence?.description)} className="h-11" autoFocus={!recurrence} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="amountCents">
          <CurrencyInput id="amountCents" name="amountCents" defaultCents={recurrence?.amountCents ?? null} required className="h-11" />
        </Field>
        <Field label="Due day" htmlFor="dueDay">
          <Input id="dueDay" name="dueDay" type="number" inputMode="numeric" min={1} max={31} required defaultValue={str("dueDay", recurrence?.dueDay)} className="h-11" />
        </Field>
      </div>

      {needsCategory(kind) && (
        <Field label="Category" htmlFor="categoryId">
          <NativeSelect id="categoryId" name="categoryId" defaultValue={str("categoryId", recurrence?.categoryId) || kindCategories[0]?.id} required className="w-full [&>select]:h-11">
            {kindCategories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.parentId ? `· ${c.name}` : c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={needsCounterAccount(kind) ? "From" : "Account"} htmlFor="accountId">
          <NativeSelect id="accountId" name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} required className="w-full [&>select]:h-11">
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {needsCounterAccount(kind) && (
          <Field label="To" htmlFor="counterAccountId">
            <NativeSelect id="counterAccountId" name="counterAccountId" defaultValue={str("counterAccountId", recurrence?.counterAccountId) || counterOptions[0]?.id} required className="w-full [&>select]:h-11">
              {counterOptions.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts on" htmlFor="startsOn">
          <Input id="startsOn" name="startsOn" type="date" required defaultValue={str("startsOn", recurrence?.startsOn) || today} className="h-11" />
        </Field>
        <Field label="Ends on" htmlFor="endsOn" hint="Optional.">
          <Input id="endsOn" name="endsOn" type="date" defaultValue={str("endsOn", recurrence?.endsOn)} className="h-11" aria-describedby="endsOn-hint" />
        </Field>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <div>
          <Label htmlFor="isVariable">Variable amount</Label>
          <p className="text-xs text-muted-foreground">An estimate; adjust each month after generating.</p>
        </div>
        <Switch id="isVariable" name="isVariable" defaultChecked={recurrence?.isVariable ?? false} />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="isActive">Active</Label>
        <Switch id="isActive" name="isActive" defaultChecked={recurrence ? recurrence.isActive : true} />
      </div>

      <SubmitButton className="w-full" pendingText="Saving…">
        {recurrence ? "Save changes" : "Add recurrence"}
      </SubmitButton>
    </form>
  );
}
