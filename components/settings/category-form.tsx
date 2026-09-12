"use client";

import { useActionState, useState } from "react";
import type { CategoryFormState } from "@/app/(app)/settings/categories/actions";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/categories/category-icon";
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
import { cn } from "@/lib/utils";

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
  const [forExpense, setForExpense] = useState(appliesTo.includes("expense"));
  const [icon, setIcon] = useState<string>(str("icon", category?.icon));
  const [color, setColor] = useState<string>(str("color", category?.color));

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
              <Checkbox
                name="appliesTo[]"
                value={kind}
                defaultChecked={appliesTo.includes(kind)}
                onCheckedChange={kind === "expense" ? (checked) => setForExpense(checked === true) : undefined}
              />
              {kind}
            </label>
          ))}
        </div>
      </fieldset>

      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="color" value={color} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Icon</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(CATEGORY_ICONS).map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={icon === name}
              onClick={() => setIcon(icon === name ? "" : name)}
              className={cn("rounded-full ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-ring", icon === name && "ring-2 ring-primary")}
            >
              <CategoryIcon icon={name} color={color || null} />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(color === c ? "" : c)}
              className={cn("size-9 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-ring", color === c && "ring-2 ring-foreground")}
              style={{ background: c }}
            />
          ))}
        </div>
      </fieldset>

      {forExpense && (
        <Field label="Monthly cap" htmlFor="monthlyCapCents" hint="Optional. Review shows progress against it; the caps together are your budget.">
          <CurrencyInput id="monthlyCapCents" name="monthlyCapCents" defaultCents={category?.monthlyCapCents ?? null} className="h-11" aria-describedby="monthlyCapCents-hint" />
        </Field>
      )}

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
