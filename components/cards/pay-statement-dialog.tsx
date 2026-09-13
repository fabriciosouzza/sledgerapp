"use client";

import { useState } from "react";
import { toast } from "sonner";
import { payStatementAction } from "@/app/(app)/cards/actions";
import { DatePicker } from "@/components/forms/date-picker";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/responsive-sheet";
import { formatBRL } from "@/lib/domain/money";
import type { Account } from "@/lib/domain/types";

/** "Pay statement": a transfer from a cash account into the card (§5.2, §7 /cards). */
export function PayStatementDialog({
  statementId,
  label,
  totalCents,
  cashAccounts,
  today,
  small = false,
}: {
  statementId: string;
  label: string;
  totalCents: number;
  cashAccounts: Pick<Account, "id" | "name">[];
  today: string;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await payStatementAction(formData);
    setPending(false);
    if (result.error) return setError(result.error);
    setOpen(false);
    toast.success(`Paid ${formatBRL(totalCents)}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant={small ? "outline" : "default"}
            className={small ? "h-9" : "h-11 w-full"}
            disabled={totalCents <= 0}
          />
        }
      >
        Pay {small ? "" : "statement"}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Pay {label}</SheetTitle>
          <SheetDescription>
            Records a transfer of {formatBRL(totalCents)} into the card. The
            purchases were already counted as expenses when they happened.
          </SheetDescription>
        </SheetHeader>
        <form action={submit} className="contents">
          <input type="hidden" name="statementId" value={statementId} />
          <SheetBody className="space-y-4 pt-4">
            <Field label="From" htmlFor={`from-${statementId}`}>
              <NativeSelect
                id={`from-${statementId}`}
                name="fromAccountId"
                required
                className="w-full [&>select]:h-11"
              >
                {cashAccounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Paid on" htmlFor={`paid-${statementId}`}>
              <DatePicker id={`paid-${statementId}`} name="paidOn" required defaultValue={today} />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? "Paying…" : `Pay ${formatBRL(totalCents)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
