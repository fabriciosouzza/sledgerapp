"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allocationSuggestionAction } from "@/app/(app)/entries/actions";
import { DatePicker } from "@/components/forms/date-picker";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { AllocationFields } from "@/components/portfolio/allocation-fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { allocationProblem } from "@/lib/domain/allocation";
import { formatBRL, parseBRL } from "@/lib/domain/money";
import { readAllocationFields } from "@/lib/schemas/allocation";
import type { AllocationLine, Entry, IsoDate } from "@/lib/domain/types";
import type { AllocationSuggestion } from "@/lib/services/entries";

/**
 * Settling a contribution asks where it goes (PROMPT.md §5.2): the sheet
 * opens pre-filled from the recurrence's default split, the amounts can be
 * changed for the month, and Settle only goes when they add up.
 */
export function AllocateSheet({
  entry,
  today,
  onClose,
  onSettle,
}: {
  entry: Entry | null;
  today: IsoDate;
  onClose: () => void;
  onSettle: (id: string, settledOn: IsoDate, allocation: AllocationLine[]) => void;
}) {
  return (
    <Sheet open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>{entry && <AllocateBody key={entry.id} entry={entry} today={today} onClose={onClose} onSettle={onSettle} />}</SheetContent>
    </Sheet>
  );
}

/** Keyed by entry, so every opening starts clean and loads its own suggestion. */
function AllocateBody({
  entry,
  today,
  onClose,
  onSettle,
}: {
  entry: Entry;
  today: IsoDate;
  onClose: () => void;
  onSettle: (id: string, settledOn: IsoDate, allocation: AllocationLine[]) => void;
}) {
  const [date, setDate] = useState<IsoDate>(today);
  const [suggestion, setSuggestion] = useState<AllocationSuggestion | null>(null);
  const [error, setError] = useState<string>();
  const redemption = entry.kind === "redemption";

  useEffect(() => {
    let cancelled = false;
    allocationSuggestionAction(entry.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setSuggestion(result.suggestion);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lines = (readAllocationFields(new FormData(e.currentTarget)).allocation ?? []).map((l) => ({ assetId: l.assetId, amountCents: parseBRL(l.amountCents) ?? 0 }));
    const problem = allocationProblem(lines, entry.amountCents);
    if (problem) return setError(problem);
    onSettle(entry.id, date, lines);
    onClose();
  }

  return (
    <form onSubmit={submit}>
      <SheetHeader>
        <SheetTitle>{redemption ? "Which assets does it come from?" : "Which assets does it go to?"}</SheetTitle>
        <SheetDescription>
          {entry.description} · {formatBRL(entry.amountCents)}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-4 pt-4">
        <FormError message={error} />
        {suggestion === null && !error && (
          <div className="space-y-2" aria-busy="true" aria-label="Loading assets">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
        {suggestion !== null && suggestion.assets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No asset to put it in yet.{" "}
            <Link href="/settings/assets/new" className="text-primary hover:underline">
              Add one
            </Link>{" "}
            first — an investment is never settled without a destination.
          </p>
        )}
        {suggestion !== null && suggestion.assets.length > 0 && (
          <AllocationFields assets={suggestion.assets} totalCents={entry.amountCents} initial={suggestion.lines} verb={redemption ? "comes from" : "goes to"} />
        )}
        <Field label={redemption ? "Received on" : "Paid on"} htmlFor="allocate-settledOn">
          <DatePicker id="allocate-settledOn" name="settledOn" value={date} onChange={(v) => v && setDate(v)} />
        </Field>
      </SheetBody>
      <SheetFooter>
        <Button type="submit" className="h-11 md:h-8" disabled={suggestion === null || suggestion.assets.length === 0}>
          Settle {formatBRL(entry.amountCents)}
        </Button>
        <Button type="button" variant="outline" className="h-11 md:h-8" onClick={onClose}>
          Cancel
        </Button>
      </SheetFooter>
    </form>
  );
}
