"use client";

import { useState } from "react";
import { DatePicker } from "@/components/forms/date-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/responsive-sheet";
import type { Entry, IsoDate } from "@/lib/domain/types";
import { formatBRL } from "@/lib/domain/money";

/** Settle with a date other than today; opened by a long press on the settle circle. */
export function SettleOnSheet({
  entry,
  today,
  onClose,
  onSettle,
}: {
  entry: Entry | null;
  today: IsoDate;
  onClose: () => void;
  onSettle: (id: string, settledOn: IsoDate) => void;
}) {
  const [date, setDate] = useState<IsoDate>(today);
  return (
    <Sheet open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settle on another day</SheetTitle>
          <SheetDescription>
            {entry ? `${entry.description} · ${formatBRL(entry.amountCents)}` : ""}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="pt-4">
          <DatePicker name="settledOn" value={date} onChange={(v) => v && setDate(v)} />
        </SheetBody>
        <SheetFooter>
          <Button
            className="h-11 md:h-8"
            onClick={() => {
              if (entry) onSettle(entry.id, date);
              onClose();
            }}
          >
            Settle
          </Button>
          <Button variant="outline" className="h-11 md:h-8" onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
