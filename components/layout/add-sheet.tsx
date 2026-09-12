"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, PiggyBank, Plus } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/responsive-sheet";
import type { EntryKind } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const KINDS: { kind: EntryKind; label: string; hint: string; icon: typeof Plus; tone: string }[] = [
  { kind: "expense", label: "Expense", hint: "Something you paid or will pay", icon: ArrowUpRight, tone: "text-red-600 dark:text-red-400" },
  { kind: "income", label: "Income", hint: "Salary, refund, benefit", icon: ArrowDownLeft, tone: "text-emerald-600 dark:text-emerald-400" },
  { kind: "transfer", label: "Transfer", hint: "Between your accounts, or a card statement", icon: ArrowLeftRight, tone: "text-foreground" },
  { kind: "contribution", label: "Contribution", hint: "Cash that becomes an investment", icon: PiggyBank, tone: "text-foreground" },
];

/** The raised "+" in the bottom nav: a sheet with the four kinds, then /add pre-set (DESIGN.md §1). */
export function AddSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(kind: EntryKind) {
    setOpen(false);
    router.push(`/add?kind=${kind}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Add"
            className="flex size-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
          />
        }
      >
        <Plus className="size-7" aria-hidden />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>What happened?</SheetTitle>
        </SheetHeader>
        <SheetBody className="grid grid-cols-2 gap-2 pt-4 pb-2">
          {KINDS.map(({ kind, label, hint, icon: Icon, tone }) => (
            <button
              key={kind}
              type="button"
              onClick={() => go(kind)}
              className="flex min-h-24 flex-col items-start gap-2 rounded-xl bg-muted/60 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon className={cn("size-6", tone)} aria-hidden />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
