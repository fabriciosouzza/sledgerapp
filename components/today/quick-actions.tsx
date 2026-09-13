"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { settleManyAction } from "@/app/(app)/entries/actions";
import { periodOf, today } from "@/lib/domain/dates";
import type { PendingMonth } from "@/lib/services/recurrences";
import { cn } from "@/lib/utils";

const base =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** One row of the things a weekly visit usually needs (DESIGN.md §2). */
export function QuickActions({ dueToday, pending: pendingMonths }: { dueToday: { id: string; description: string; kind: string }[]; pending: PendingMonth[] }) {
  const dueTodayIds = dueToday.map((e) => e.id);
  const names = dueToday.map((e) => e.description);
  const dueLabel = names.length <= 2 ? names.join(" + ") : `${names.length} due today`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = periodOf(today());
  const past = pendingMonths.filter((m) => m.period !== current);
  const toGenerate = pendingMonths.reduce((n, m) => n + m.count, 0);
  const pastCount = past.reduce((n, m) => n + m.count, 0);

  function settleDueToday() {
    startTransition(async () => {
      const result = await settleManyAction(dueTodayIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Settled ${names.join(", ")}`);
      router.refresh();
    });
  }

  return (
    <div className="tile-strip" role="group" aria-label="Quick actions">
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
        <button type="button" onClick={settleDueToday} disabled={pending} title={names.join(", ")} className={cn(base, "border-primary/40")}>
          <CheckCheck className="size-4" aria-hidden />
          Settle {dueLabel}
        </button>
      )}
      {/* Earlier months are not flagged here: a template recorded by hand looks "not applied" forever. Review shows them. */}
      {toGenerate - pastCount > 0 && (
        <Link href="/review" className={cn(base, "border-primary/40")}>
          <Sparkles className="size-4" aria-hidden />
          Generate {toGenerate - pastCount} recurring
        </Link>
      )}
    </div>
  );
}
