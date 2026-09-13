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
  /** With today's balance when known, so "can I pay without touching savings?" is answered in the sheet. */
  cashAccounts: (Pick<Account, "id" | "name"> & { balanceCents?: number | null })[];
  today: string;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState(cashAccounts[0]?.id ?? "");
  const from = cashAccounts.find((a) => a.id === fromId);
  const short = from?.balanceCents !== undefined && from.balanceCents !== null ? totalCents - from.balanceCents : null;
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
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full [&>select]:h-11"
              >
                {cashAccounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                    {a.balanceCents !== undefined && a.balanceCents !== null ? ` · ${formatBRL(a.balanceCents)}` : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <p className="text-xs text-muted-foreground">A statement is paid whole, from one account. To split it, transfer between your accounts first.</p>
            {short !== null && short > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                {formatBRL(short)} short on {from?.name}: pay from another account, or transfer first.
              </p>
            )}
            <Field label="Paid on" htmlFor={`paid-${statementId}`}>
              <DatePicker id={`paid-${statementId}`} name="paidOn" required defaultValue={today} />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="h-11 md:h-8" disabled={pending}>
              {pending ? "Paying…" : `Pay ${formatBRL(totalCents)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-8"
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
