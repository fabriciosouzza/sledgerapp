"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/responsive-sheet";
import { deleteAccountAction } from "./actions";

export function DeleteAccountSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await deleteAccountAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-sm font-semibold">Delete account</h2>
      <p className="text-xs text-muted-foreground">Removes your sign-in and everything you recorded. Download the export first if you want to keep it.</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="destructive" className="h-11 w-full" />}>Delete my account…</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Delete everything?</SheetTitle>
            <SheetDescription>This cannot be undone. Type your email to confirm.</SheetDescription>
          </SheetHeader>
          <form action={submit} className="contents">
            <SheetBody className="space-y-2 pt-4">
              <Label htmlFor="confirm-email">{email}</Label>
              <Input id="confirm-email" name="confirm" type="email" autoComplete="off" required className="h-11 md:h-8" />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </SheetBody>
            <SheetFooter>
              <Button type="submit" variant="destructive" className="h-11 md:h-8" disabled={pending}>
                {pending ? "Deleting…" : "Delete my account"}
              </Button>
              <Button type="button" variant="outline" className="h-11 md:h-8" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
