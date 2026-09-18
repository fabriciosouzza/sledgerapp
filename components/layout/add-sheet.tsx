"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, PiggyBank, Plus } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/responsive-sheet";
import type { EntryKind } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const KINDS: { kind: EntryKind; label: string; hint: string; icon: typeof Plus; tone: string }[] = [
  { kind: "expense", label: "Expense", hint: "Something you paid or will pay", icon: ArrowUpRight, tone: "text-foreground" },
  { kind: "income", label: "Income", hint: "Salary, refund, benefit", icon: ArrowDownLeft, tone: "text-positive" },
  { kind: "transfer", label: "Transfer", hint: "Between your own accounts", icon: ArrowLeftRight, tone: "text-foreground" },
  { kind: "contribution", label: "Contribution", hint: "Cash that becomes an investment", icon: PiggyBank, tone: "text-foreground" },
];

/** The "Add" tab in the bottom nav, a plain tab like the others: a sheet with the four kinds, then /add pre-set (DESIGN.md §1, 2026-09-18). */
export function AddSheet({ current = false }: { current?: boolean }) {
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
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              current ? "text-foreground" : "text-muted-foreground",
            )}
          />
        }
      >
        <Plus className="size-5 shrink-0" aria-hidden />
        <span className="max-w-full truncate px-0.5">Add</span>
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
