"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSnapshotAction } from "@/app/(app)/net-worth/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatPeriodLong } from "@/lib/domain/dates";
import type { SnapshotLine } from "@/lib/services/netWorth";

/** Every account at once, one month (§7 /net-worth). */
export function SnapshotForm({ period, lines, hasSnapshot }: { period: string; lines: SnapshotLine[]; hasSnapshot: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await saveSnapshotAction(formData);
      if (!result.ok) return setError(result.error);
      toast.success(`Snapshot saved for ${formatPeriodLong(period)}`);
      router.refresh();
    });
  }

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a cash account or a card first.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="period" value={period} />
      <FormError message={error} />
      <ul className="space-y-3">
        {lines.map(({ account, kind, amountCents }) => (
          <li key={account.id} className="grid grid-cols-[1fr_9.5rem] items-center gap-3">
            <Label htmlFor={`balance-${account.id}`} className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate">{account.name}</span>
              <Badge variant={kind === "debt" ? "destructive" : "secondary"}>{kind === "debt" ? "debt" : "cash"}</Badge>
            </Label>
            <CurrencyInput key={`${period}-${account.id}-${amountCents ?? "none"}`} id={`balance-${account.id}`} name={`balance:${account.id}`} defaultCents={amountCents} className="h-11 text-right" />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Leave an account blank to skip it. Card balances are the amount owed.</p>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : hasSnapshot ? "Update snapshot" : "Save snapshot"}
      </Button>
    </form>
  );
}
