"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { settleManyAction, unsettleManyAction } from "@/app/(app)/entries/actions";
import { periodOf, today } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import type { PendingMonth } from "@/lib/services/recurrences";
import { cn } from "@/lib/utils";

const base =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** The agenda's own actions: settle what is due today, apply the month's recurring entries. Adding an entry is the FAB's job. Nothing to do, nothing shown. */
export function QuickActions({ dueToday, pending: pendingMonths }: { dueToday: { id: string; description: string; kind: string; amountCents: number }[]; pending: PendingMonth[] }) {
  const dueTodayIds = dueToday.map((e) => e.id);
  const names = dueToday.map((e) => e.description);
  const dueLabel = names.length <= 2 ? names.join(" + ") : `${names.length} due today`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = periodOf(today());
  const past = pendingMonths.filter((m) => m.period !== current);
  const toGenerate = pendingMonths.reduce((n, m) => n + m.count, 0);
  const pastCount = past.reduce((n, m) => n + m.count, 0);
  if (dueTodayIds.length === 0 && toGenerate - pastCount <= 0) return null;

  function settleDueToday() {
    startTransition(async () => {
      const result = await settleManyAction(dueTodayIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const total = dueToday.reduce((sum, e) => sum + e.amountCents, 0);
      toast.success(`Settled ${names.join(", ")} · ${formatBRL(total)}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undone = await unsettleManyAction(dueTodayIds);
            if (!undone.ok) toast.error(undone.error);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
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
