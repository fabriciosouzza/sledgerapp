"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteEntryAction } from "@/app/(app)/entries/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Entry } from "@/lib/domain/types";

/** Confirmation, and scope when the entry is one part of an installment plan (§8). */
export function DeleteEntryDialog({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [scope, setScope] = useState<"this" | "this_and_future" | "all">("this");
  const installment = entry.installmentGroupId !== null;

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await deleteEntryAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Delete entry" className="size-11" />}>
        <Trash2 aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {installment ? "installments?" : "this entry?"}</DialogTitle>
          <DialogDescription>
            {installment
              ? `Part ${entry.installmentNo} of ${entry.installmentTotal}. Choose how much of the plan goes.`
              : "This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="id" value={entry.id} />
          {installment && (
            <fieldset className="space-y-1">
              {(
                [
                  ["this", `Only part ${entry.installmentNo}/${entry.installmentTotal}`],
                  ["this_and_future", "This and future parts"],
                  ["all", "All parts"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="size-4 accent-primary" />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" className="h-11 sm:h-8" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
