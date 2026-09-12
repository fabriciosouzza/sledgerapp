"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { settleManyAction } from "@/app/(app)/entries/actions";
import { cn } from "@/lib/utils";

const base =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** One row of the things a weekly visit usually needs (DESIGN.md §2). */
export function QuickActions({ dueTodayIds, toGenerate }: { dueTodayIds: string[]; toGenerate: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function settleDueToday() {
    startTransition(async () => {
      const result = await settleManyAction(dueTodayIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Settled ${dueTodayIds.length} due today`);
      router.refresh();
    });
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Quick actions">
      <Link href="/add?kind=expense" className={base}>
        <ArrowUpRight className="size-4 text-red-600 dark:text-red-400" aria-hidden />
        Expense
      </Link>
      <Link href="/add?kind=income" className={base}>
        <ArrowDownLeft className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Income
      </Link>
      <Link href="/add?kind=transfer" className={base}>
        <ArrowLeftRight className="size-4" aria-hidden />
        Transfer
      </Link>
      {dueTodayIds.length > 0 && (
        <button type="button" onClick={settleDueToday} disabled={pending} className={cn(base, "border-primary/40")}>
          <CheckCheck className="size-4" aria-hidden />
          Settle {dueTodayIds.length} due today
        </button>
      )}
      {toGenerate > 0 && (
        <Link href="/review" className={cn(base, "border-primary/40")}>
          <Sparkles className="size-4" aria-hidden />
          Generate {toGenerate} recurring
        </Link>
      )}
    </div>
  );
}
