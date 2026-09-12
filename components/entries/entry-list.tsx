"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check, CheckCheck, ChevronDown, Circle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { loadMonthAction, settleEntryAction, settleManyAction, unsettleEntryAction } from "@/app/(app)/entries/actions";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { addMonths, formatDate, formatPeriodLong, periodOf } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { groupByDay, installmentLabel } from "@/lib/domain/entries";
import { entryTiming } from "@/lib/domain/metrics";
import type { Entry, Period } from "@/lib/domain/types";
import type { EntryFilters } from "@/lib/repositories";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";
import type { Lookups } from "./lookups";

type Patch = { id: string; status: Entry["status"]; settledOn: string | null };

function applyPatch(list: Entry[], patch: Patch): Entry[] {
  return list.map((e) => (e.id === patch.id ? { ...e, status: patch.status, settledOn: patch.settledOn } : e));
}

export function EntryList({
  initial,
  period,
  filters,
  lookups,
  today,
  infinite = true,
  selectable = true,
  ascending = false,
  title,
  summary = false,
  emptyMessage = "Nothing here.",
}: {
  initial: Entry[];
  period: Period;
  filters: Omit<EntryFilters, "period" | "from" | "to">;
  lookups: Lookups;
  today: string;
  /** Show "earlier month" loading and month headers. */
  infinite?: boolean;
  /** Offer multi-select bulk settle. */
  selectable?: boolean;
  /** Oldest day first (for what is coming up) instead of newest first. */
  ascending?: boolean;
  /** Section title, rendered on the same row as the bulk-settle trigger. */
  title?: string;
  /** Append "N to settle · R$ X" to the title, live as rows get settled. */
  summary?: boolean;
  emptyMessage?: string;
}) {
  const [entries, setEntries] = useState(initial);
  const [optimistic, patchOptimistic] = useOptimistic(entries, applyPatch);
  const [oldest, setOldest] = useState(period);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [loadingMore, startLoading] = useTransition();

  function settle(id: string) {
    startTransition(async () => {
      patchOptimistic({ id, status: "settled", settledOn: today });
      const result = await settleEntryAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => applyPatch(prev, { id, status: "settled", settledOn: today }));
      toast.success("Settled", { action: { label: "Undo", onClick: () => unsettle(id) } });
    });
  }

  function unsettle(id: string) {
    startTransition(async () => {
      patchOptimistic({ id, status: "planned", settledOn: null });
      const result = await unsettleEntryAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => applyPatch(prev, { id, status: "planned", settledOn: null }));
    });
  }

  function settleSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      for (const id of ids) patchOptimistic({ id, status: "settled", settledOn: today });
      const result = await settleManyAction(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => ids.reduce((list, id) => applyPatch(list, { id, status: "settled", settledOn: today }), prev));
      setSelected(new Set());
      setSelecting(false);
      toast.success(`Settled ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`);
    });
  }

  function loadEarlier() {
    const previous = addMonths(oldest, -1);
    startLoading(async () => {
      const more = await loadMonthAction(previous, filters);
      setEntries((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
      setOldest(previous);
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const byMonth = new Map<Period, Entry[]>();
  for (const e of optimistic) {
    const p = periodOf(e.date);
    byMonth.set(p, [...(byMonth.get(p) ?? []), e]);
  }
  const months = [...byMonth.keys()].sort((a, b) => (a < b ? 1 : -1) * (ascending ? -1 : 1));
  const plannedRows = optimistic.filter((e) => e.status === "planned");
  const plannedIds = plannedRows.map((e) => e.id);
  const plannedExpense = plannedRows.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amountCents, 0);
  // Bulk settle earns its control only when there is more than one thing to settle.
  const canSelect = selectable && plannedIds.length > 1;

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      {(title || canSelect) && (
        <div className="flex min-h-9 items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-semibold">
              {title}
              {summary && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {plannedIds.length === 0 ? "all settled" : `${plannedIds.length} to settle${plannedExpense > 0 ? ` · ${formatBRL(plannedExpense)}` : ""}`}
                </span>
              )}
            </h2>
          ) : (
            <span />
          )}
          {canSelect && (
            <Button
              variant={selecting ? "secondary" : "ghost"}
              size="sm"
              className="h-9"
              aria-pressed={selecting}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              <CheckCheck data-icon="inline-start" aria-hidden />
              Settle several…
            </Button>
          )}
        </div>
      )}

      {selecting && (
        <div
          role="toolbar"
          aria-label="Bulk settle"
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-2 backdrop-blur md:bottom-0 md:left-56"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {selected.size === 0 ? "Tap the entries to settle" : `${selected.size} selected`}
            </span>
            <Button variant="ghost" className="h-11" onClick={() => setSelected(new Set(selected.size === plannedIds.length ? [] : plannedIds))}>
              {selected.size === plannedIds.length ? "None" : "All"}
            </Button>
            <Button variant="ghost" className="h-11" onClick={stopSelecting}>
              Cancel
            </Button>
            <Button className="h-11" onClick={settleSelected} disabled={selected.size === 0 || pending}>
              <CheckCheck data-icon="inline-start" aria-hidden />
              Settle{selected.size > 0 ? ` ${selected.size}` : ""}
            </Button>
          </div>
        </div>
      )}

      {optimistic.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>}

      {months.map((month) => (
        <section key={month}>
          {infinite && (
            <h2 className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 text-sm font-semibold backdrop-blur md:-mx-8 md:px-8">
              {formatPeriodLong(month)}
            </h2>
          )}
          <div className="space-y-3">
            {(ascending ? groupByDay(byMonth.get(month) ?? []).reverse() : groupByDay(byMonth.get(month) ?? [])).map((day) => (
              <div key={day.date}>
                <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                  {day.date === today ? "Today" : formatDate(day.date)}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  {day.entries.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      lookups={lookups}
                      today={today}
                      selecting={selecting}
                      selected={selected.has(entry.id)}
                      onToggle={() => toggle(entry.id)}
                      onSettle={() => settle(entry.id)}
                      onUnsettle={() => unsettle(entry.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      {selecting && <div className="h-16" aria-hidden />}

      {infinite && (
        <Button variant="outline" className="h-11 w-full" onClick={loadEarlier} disabled={loadingMore}>
          <ChevronDown data-icon="inline-start" aria-hidden />
          {loadingMore ? "Loading…" : `Load ${formatPeriodLong(addMonths(oldest, -1))}`}
        </Button>
      )}
    </div>
  );
}

const SWIPE_THRESHOLD = 72;

function EntryRow({
  entry,
  lookups,
  today,
  selecting,
  selected,
  onToggle,
  onSettle,
  onUnsettle,
}: {
  entry: Entry;
  lookups: Lookups;
  today: string;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onSettle: () => void;
  onUnsettle: () => void;
}) {
  const timing = entryTiming(entry, today);
  const categoryRow = entry.categoryId ? lookups.categories[entry.categoryId] : undefined;
  const category = categoryRow?.name ?? null;
  const account = lookups.accounts[entry.accountId]?.name ?? "?";
  const counter = entry.counterAccountId ? lookups.accounts[entry.counterAccountId]?.name : null;
  const parts = installmentLabel(entry);
  const meta = [parts, category, counter ? `${account} → ${counter}` : account].filter(Boolean).join(" · ");

  // Swipe right to settle, left to edit (§7 /entries). Mouse users have the buttons.
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const editHref = `/entries/${entry.id}`;

  function onTouchStart(e: React.TouchEvent) {
    if (selecting) return;
    startX.current = e.touches[0].clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const delta = e.touches[0].clientX - startX.current;
    if (delta > 0 && entry.status !== "planned") return;
    setDx(Math.max(-120, Math.min(120, delta)));
  }
  function onTouchEnd() {
    if (dx >= SWIPE_THRESHOLD && entry.status === "planned") onSettle();
    else if (dx <= -SWIPE_THRESHOLD) router.push(editHref);
    setDx(0);
    startX.current = null;
  }

  return (
    <li className="relative overflow-hidden">
      {dx !== 0 && (
        <div
          className={cn(
            "absolute inset-y-0 flex items-center px-4 text-xs font-medium",
            dx > 0 ? "left-0 text-emerald-600 dark:text-emerald-400" : "right-0 text-muted-foreground",
          )}
          aria-hidden
        >
          {dx > 0 ? "Settle" : "Edit"}
        </div>
      )}
      <div
        className={cn("relative flex min-h-14 items-center gap-2 bg-card pr-2 pl-3 transition-transform", entry.status === "settled" && "opacity-70")}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {selecting && (
          <span className="flex size-11 items-center justify-center">
            <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${entry.description}`} disabled={entry.status === "settled"} />
          </span>
        )}
        {!selecting && (
          <CategoryIcon
            icon={categoryRow?.icon ?? (entry.kind === "transfer" ? "landmark" : entry.kind === "contribution" ? "piggy-bank" : null)}
            color={categoryRow?.color ?? null}
            size="sm"
          />
        )}
        <Link
          href={editHref}
          onClick={(e) => {
            if (selecting) {
              e.preventDefault();
              if (entry.status === "planned") onToggle();
            }
          }}
          className="flex min-w-0 flex-1 flex-col justify-center py-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{entry.description}</span>
            {timing === "overdue" && (
              <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 uppercase dark:text-red-400">
                overdue
              </span>
            )}
            {timing === "settled" && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 uppercase dark:text-emerald-400">
                settled
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        </Link>
        <Amount kind={entry.kind} cents={entry.amountCents} className="shrink-0 text-sm font-semibold" />
        {!selecting &&
          (entry.status === "planned" ? (
            <button
              type="button"
              onClick={onSettle}
              aria-label={`Settle ${entry.description}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Circle className="size-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onUnsettle}
              aria-label={`Undo settle ${entry.description}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-emerald-600 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring dark:text-emerald-400"
            >
              <Check className="size-5" aria-hidden />
            </button>
          ))}
        <Link href={editHref} aria-label={`Edit ${entry.description}`} className="hidden size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground md:flex">
          <Pencil className="size-4" aria-hidden />
        </Link>
      </div>
    </li>
  );
}
