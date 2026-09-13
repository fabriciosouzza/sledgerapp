"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/responsive-sheet";

/**
 * Confirmation on destructive actions (§8): a bottom sheet on mobile, a dialog
 * on desktop. Renders a trigger; on confirm submits `action` with the hidden fields.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  action,
  fields,
  onError,
}: {
  /** A `<Button>` (or any element rendering a native button); the sheet attaches to it. */
  trigger: React.ReactElement<Record<string, unknown>>;
  title: string;
  description: string;
  confirmLabel: string;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  fields: Record<string, string>;
  onError?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await action(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      onError?.(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent initialFocus={cancelRef}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {error && <p className="px-4 text-sm text-destructive md:px-0">{error}</p>}
        <SheetFooter>
          <form action={submit} className="contents">
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Button type="submit" variant="destructive" className="h-11 w-full md:w-auto" disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          </form>
          <Button ref={cancelRef} type="button" variant="outline" className="h-11" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
