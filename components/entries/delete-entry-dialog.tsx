"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteEntryAction } from "@/app/(app)/entries/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/responsive-sheet";
import type { Entry } from "@/lib/domain/types";

/** Confirmation, and scope when the entry is one part of an installment plan (§8). */
export function DeleteEntryDialog({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string>();
  const [scope, setScope] = useState<"this" | "this_and_future" | "all">("this");
  const installment = entry.installmentGroupId !== null;

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await deleteEntryAction(formData);
    setPending(false);
    if (result.error) return setError(result.error);
    toast.success(result.deleted && result.deleted > 1 ? `Deleted ${result.deleted} parts` : `Deleted "${entry.description}"`);
    router.push("/entries");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Delete entry" className="size-11" />}>
        <Trash2 aria-hidden />
      </SheetTrigger>
      <SheetContent initialFocus={cancelRef}>
        <SheetHeader>
          <SheetTitle>Delete {installment ? "installments?" : "this entry?"}</SheetTitle>
          <SheetDescription>
            {installment ? `Part ${entry.installmentNo} of ${entry.installmentTotal}. Choose how much of the plan goes.` : "This cannot be undone."}
          </SheetDescription>
        </SheetHeader>
        <form action={submit} className="contents">
          <input type="hidden" name="id" value={entry.id} />
          {installment && (
            <SheetBody>
              <fieldset className="space-y-1">
                {(
                  [
                    ["this", `Only part ${entry.installmentNo}/${entry.installmentTotal}`],
                    ["this_and_future", "This and future parts"],
                    ["all", "All parts"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="size-5 accent-primary" />
                    {label}
                  </label>
                ))}
              </fieldset>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </SheetBody>
          )}
          {!installment && error && <p className="px-4 text-sm text-destructive md:px-0">{error}</p>}
          <SheetFooter>
            <Button type="submit" variant="destructive" className="h-11" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
            <Button ref={cancelRef} type="button" variant="outline" className="h-11" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
