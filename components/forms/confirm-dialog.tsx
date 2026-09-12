"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Confirmation on destructive actions (§8). Renders a trigger; on confirm
 * submits `action` with the given hidden fields.
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
  /** A `<Button>` (or any element rendering a native button); the dialog attaches to it. */
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <form action={submit}>
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Button type="submit" variant="destructive" className="h-11 w-full sm:h-8 sm:w-auto" disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
