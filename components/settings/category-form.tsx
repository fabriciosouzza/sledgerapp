"use client";

import { useActionState } from "react";
import type { CategoryFormState } from "@/app/(app)/settings/categories/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { Category } from "@/lib/domain/types";

export function CategoryForm({
  category,
  parents,
  action,
}: {
  category?: Category;
  /** Top-level categories that may be chosen as parent. */
  parents: Pick<Category, "id" | "name">[];
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
}) {
  const [state, dispatch] = useActionState(action, {});
  const v = state.values ?? {};
  const str = (key: string, fallback: string | number | null | undefined) =>
    typeof v[key] === "string" ? v[key] : fallback === null || fallback === undefined ? "" : String(fallback);
  const appliesTo = Array.isArray(v.appliesTo) ? v.appliesTo : (category?.appliesTo ?? ["expense"]);

  return (
    <form action={dispatch} className="space-y-5">
      {category && <input type="hidden" name="id" value={category.id} />}
      <FormError message={state.error} />

      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={60} defaultValue={str("name", category?.name)} className="h-11" autoFocus={!category} />
      </Field>

      <Field label="Parent" htmlFor="parentId" hint="Optional. One level only.">
        <NativeSelect
          id="parentId"
          name="parentId"
          defaultValue={str("parentId", category?.parentId)}
          className="w-full [&>select]:h-11"
          aria-describedby="parentId-hint"
        >
          <NativeSelectOption value="">None (top level)</NativeSelectOption>
          {parents.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Applies to</legend>
        <div className="flex gap-6">
          {(["expense", "income"] as const).map((kind) => (
            <label key={kind} className="flex min-h-11 items-center gap-2 text-sm capitalize">
              <Checkbox name="appliesTo[]" value={kind} defaultChecked={appliesTo.includes(kind)} />
              {kind}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Monthly cap" htmlFor="monthlyCapCents" hint="Optional. The month screen shows progress against it.">
        <CurrencyInput id="monthlyCapCents" name="monthlyCapCents" defaultCents={category?.monthlyCapCents ?? null} className="h-11" aria-describedby="monthlyCapCents-hint" />
      </Field>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <div>
          <Label htmlFor="isBenefit">Benefit</Label>
          <p className="text-xs text-muted-foreground">Meal voucher, allowance: excluded from the second savings rate.</p>
        </div>
        <Switch id="isBenefit" name="isBenefit" defaultChecked={category?.isBenefit ?? false} />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="isActive">Active</Label>
        <Switch id="isActive" name="isActive" defaultChecked={category ? category.isActive : true} />
      </div>

      <SubmitButton className="w-full" pendingText="Saving…">
        {category ? "Save changes" : "Add category"}
      </SubmitButton>
    </form>
  );
}
