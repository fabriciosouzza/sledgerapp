"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, CheckCheck, ChevronDown, Circle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { loadMonthAction, settleEntryAction, settleManyAction, unsettleEntryAction } from "@/app/(app)/entries/actions";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { addMonths, formatDate, formatPeriodLong, periodOf } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { groupByDay, installmentLabel } from "@/lib/domain/entries";
import { entryTiming } from "@/lib/domain/metrics";
import type { Entry, IsoDate, Period } from "@/lib/domain/types";
import type { EntryFilters } from "@/lib/repositories";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";
import type { Lookups } from "./lookups";
import { SettleOnSheet } from "./settle-on-sheet";
import { DatePicker } from "@/components/forms/date-picker";

type Patch = { id: string; status: Entry["status"]; settledOn: string | null };

function applyPatch(list: Entry[], patch: Patch): Entry[] {
  return list.map((e) => (e.id === patch.id ? { ...e, status: patch.status, settledOn: patch.settledOn } : e));
}

/** "3 to pay · R$ 400,00 · 1 to receive" — income is not something you settle. */
function summaryText(planned: Entry[], plannedExpense: number): string {
  const toReceive = planned.filter((e) => e.kind === "income").length;
  const toPay = planned.length - toReceive;
  const parts: string[] = [];
  if (toPay > 0) parts.push(`${toPay} to pay${plannedExpense > 0 ? ` · ${formatBRL(plannedExpense)}` : ""}`);
  if (toReceive > 0) parts.push(`${toReceive} to receive`);
  return parts.join(" · ");
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
  settleHint = true,
}: {
  initial: Entry[];
  period: Period;
  filters: Omit<EntryFilters, "period" | "from" | "to">;
  lookups: Lookups;
  today: string;
  /** Show "earlier month" loading and month headers. */
  infinite?: boolean;
  /** Card statement rows are paid through the statement: no settle hint. */
  settleHint?: boolean;
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
  // Settled from this list, this visit: these rows keep a "settled" badge as confirmation.
  const [recent, setRecent] = useState<Set<string>>(new Set());
  // When the server sends new rows (after a refresh), take them as the truth
  // but keep the rows settled here that it no longer returns, so a settled
  // entry stays visible with its undo instead of vanishing.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setEntries((local) => {
      const serverIds = new Set(initial.map((e) => e.id));
      const kept = local.filter((e) => !serverIds.has(e.id) && recent.has(e.id));
      return [...initial, ...kept];
    });
  }
  const [optimistic, patchOptimistic] = useOptimistic(entries, applyPatch);
  const [oldest, setOldest] = useState(period);
  const [selecting, setSelecting] = useState(false);
  const [bulkDate, setBulkDate] = useState<IsoDate>(today);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [loadingMore, startLoading] = useTransition();
  const [settleOnTarget, setSettleOnTarget] = useState<Entry | null>(null);

  function settle(id: string, settledOn: string = today) {
    startTransition(async () => {
      patchOptimistic({ id, status: "settled", settledOn });
      const result = await settleEntryAction(id, settledOn);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => applyPatch(prev, { id, status: "settled", settledOn }));
      setRecent((prev) => new Set(prev).add(id));
      toast.success(settledOn === today ? "Settled" : `Settled on ${formatDate(settledOn)}`, { action: { label: "Undo", onClick: () => unsettle(id) } });
    });
  }

  function unsettle(id: string) {
    const previous = entries.find((e) => e.id === id);
    const wasSettledOn = previous?.settledOn ?? today;
    startTransition(async () => {
      patchOptimistic({ id, status: "planned", settledOn: null });
      const result = await unsettleEntryAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => applyPatch(prev, { id, status: "planned", settledOn: null }));
      setRecent((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // The ✓ looks like "confirm"; say what it did and offer the way back.
      toast(`${previous?.description ?? "Entry"} is planned again`, {
        description: `It was ${previous?.kind === "income" ? "received" : "paid"} on ${formatDate(wasSettledOn)}.`,
        action: { label: "Undo", onClick: () => settle(id, wasSettledOn) },
      });
    });
  }

  function settleSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const settledOn = bulkDate;
    startTransition(async () => {
      for (const id of ids) patchOptimistic({ id, status: "settled", settledOn });
      const result = await settleManyAction(ids, settledOn);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => ids.reduce((list, id) => applyPatch(list, { id, status: "settled", settledOn }), prev));
      setRecent((prev) => new Set([...prev, ...ids]));
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
            <h2 className="text-sm font-semibold" aria-live="polite">
              {title}
              {summary && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {plannedIds.length === 0 ? "all settled" : summaryText(plannedRows, plannedExpense)}
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

      {settleHint && plannedIds.length > 0 && !selecting && (
        <p className="-mt-2 text-xs text-muted-foreground">
          <span className="md:hidden">Tap ○ to settle today · hold it to pick the day</span>
          <span className="hidden md:inline">○ settles today · the calendar picks the day</span>
        </p>
      )}

      {selecting && (
        <div
          role="toolbar"
          aria-label="Bulk settle"
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-2 backdrop-blur md:bottom-0 md:left-56"
        >
          <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 md:flex lg:max-w-4xl xl:max-w-5xl">
            <span className="min-w-0 truncate text-sm md:flex-1">
              {selected.size === 0 ? "Tap the entries to settle" : `${selected.size} selected`}
            </span>
            <Button variant="ghost" className="h-11" onClick={() => setSelected(new Set(selected.size === plannedIds.length ? [] : plannedIds))}>
              {selected.size === plannedIds.length ? "None" : "All"}
            </Button>
            <Button variant="ghost" className="h-11" onClick={stopSelecting}>
              Cancel
            </Button>
            <div className="col-span-2 md:w-40" aria-label="Settled on">
              <DatePicker name="bulkSettledOn" value={bulkDate} onChange={(v) => v && setBulkDate(v)} className="h-11" />
            </div>
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
                      justSettled={recent.has(entry.id)}
                      onToggle={() => toggle(entry.id)}
                      onSettle={() => settle(entry.id)}
                      onSettleOn={() => setSettleOnTarget(entry)}
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

      <SettleOnSheet entry={settleOnTarget} today={today} onClose={() => setSettleOnTarget(null)} onSettle={(id, date) => settle(id, date)} />

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
  justSettled,
  onToggle,
  onSettle,
  onSettleOn,
  onUnsettle,
}: {
  entry: Entry;
  lookups: Lookups;
  today: string;
  selecting: boolean;
  selected: boolean;
  justSettled: boolean;
  onToggle: () => void;
  onSettle: () => void;
  /** Long press on the settle circle: pick the date. */
  onSettleOn: () => void;
  onUnsettle: () => void;
}) {
  const timing = entryTiming(entry, today);
  // Income is received, everything else is paid.
  const settleVerb = (e: Entry) => (e.kind === "income" ? "Receive" : "Settle");
  const categoryRow = entry.categoryId ? lookups.categories[entry.categoryId] : undefined;
  const category = categoryRow?.name ?? null;
  const account = lookups.accounts[entry.accountId]?.name ?? "?";
  const counter = entry.counterAccountId ? lookups.accounts[entry.counterAccountId]?.name : null;
  const parts = installmentLabel(entry);
  const meta = [parts, category, counter ? `${account} → ${counter}` : account].filter(Boolean).join(" · ");

  // Swipe right to settle, left to edit (§7 /entries). Mouse users have the buttons.
  const router = useRouter();
  const startX = useRef<number | null>(null);
  // Long press on the settle circle opens the date sheet; a normal tap settles today.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  // Touch only: a slow mouse click must not turn into "pick the date" (desktop has its own button).
  function pressStart(e: React.PointerEvent) {
    longPressed.current = false;
    if (e.pointerType !== "touch") return;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onSettleOn();
    }, 450);
  }
  function pressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
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
              <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-700 uppercase dark:text-red-400">
                {entry.kind === "income" ? "late" : "overdue"}
              </span>
            )}
            {timing === "settled" && justSettled && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 uppercase dark:text-emerald-400">
                {entry.kind === "income" ? "received" : "paid"}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground md:text-sm">{meta}</span>
        </Link>
        <Amount kind={entry.kind} cents={entry.amountCents} className="shrink-0 text-sm font-semibold" />
        {!selecting &&
          (entry.status === "planned" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (longPressed.current) return;
                  onSettle();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.shiftKey) {
                    e.preventDefault();
                    onSettleOn();
                  }
                }}
                onPointerDown={pressStart}
                onPointerUp={pressEnd}
                onPointerLeave={pressEnd}
                onPointerCancel={pressEnd}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`${settleVerb(entry)} ${entry.description} today`}
                title={`${settleVerb(entry)} today · Shift+Enter for another day`}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring md:px-3"
              >
                <Circle className="size-5" aria-hidden />
                <span className="hidden text-sm font-medium md:inline">{settleVerb(entry)}</span>
              </button>
              <button
                type="button"
                onClick={onSettleOn}
                aria-label={`${settleVerb(entry)} ${entry.description} on another day`}
                title="Pick the day"
                className="hidden size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring md:flex"
              >
                <CalendarDays className="size-4" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUnsettle}
              aria-label={`Mark ${entry.description} as not ${entry.kind === "income" ? "received" : "paid"}`}
              title={`${entry.kind === "income" ? "Received" : "Paid"} · click to undo`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-emerald-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring dark:text-emerald-400"
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
