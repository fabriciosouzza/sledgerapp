"use client";

import { useState } from "react";
import { toast } from "sonner";
import { payStatementAction } from "@/app/(app)/cards/actions";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={small ? "outline" : "default"} className={small ? "h-9" : "h-11 w-full"} disabled={totalCents <= 0} />}>
        Pay {small ? "" : "statement"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {label}</DialogTitle>
          <DialogDescription>
            Records a transfer of {formatBRL(totalCents)} into the card. The purchases were already counted as expenses when they happened.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="statementId" value={statementId} />
          <Field label="From" htmlFor={`from-${statementId}`}>
            <NativeSelect id={`from-${statementId}`} name="fromAccountId" required className="w-full [&>select]:h-11">
              {cashAccounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Paid on" htmlFor={`paid-${statementId}`}>
            <Input id={`paid-${statementId}`} name="paidOn" type="date" required defaultValue={today} className="h-11" />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-11 sm:h-8" disabled={pending}>
              {pending ? "Paying…" : `Pay ${formatBRL(totalCents)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
