"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, CheckCheck, ChevronDown, Circle, CreditCard, Pencil } from "lucide-react";
import { toast } from "sonner";
import { loadMonthAction, settleEntryAction, settleManyAction, unsettleEntryAction, unsettleManyAction } from "@/app/(app)/entries/actions";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Button } from "@/components/ui/button";
import { useLocalMemory } from "@/lib/client/local-memory";
import { Checkbox } from "@/components/ui/checkbox";
import { addMonths, formatDate, formatDayMonth, formatPeriodLong, formatPeriodShort, periodOf } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
import { groupByDay, installmentLabel, needsAllocation } from "@/lib/domain/entries";
import { entryTiming } from "@/lib/domain/metrics";
import { resolveCycle } from "@/lib/domain/statements";
import type { AllocationLine, Entry, IsoDate, Period } from "@/lib/domain/types";
import type { EntryFilters } from "@/lib/repositories";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";
import type { Lookups } from "./lookups";
import { AllocateSheet } from "./allocate-sheet";
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
  emptyAction,
  settleHint = true,
  meta,
  statementLink = true,
  collapseFuture = false,
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
  /** An action under the empty message (§8: empty states with an action). */
  emptyAction?: React.ReactNode;
  /** Shown where a title would be (the totals on Entries), so "Settle several…" never floats alone. */
  meta?: React.ReactNode;
  /** Card purchases link to their statement; off where that statement is already on screen (Cards). */
  statementLink?: boolean;
  /** Fold the days after today into one row (Entries, this month): the list opens on what happened. */
  collapseFuture?: boolean;
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
  // A contribution settles with its allocation (§5.2): its own sheet, with the date inside.
  const [allocateTarget, setAllocateTarget] = useState<Entry | null>(null);
  // Rows settled a moment ago: a tap on their ✓ is the second half of a double tap, not an undo.
  const settleGrace = useRef(new Set<string>());
  const [hintDismissed, dismissHint] = useLocalMemory("sledger.settleHintDismissed", false);
  const [showFuture, setShowFuture] = useState(false);

  function settle(id: string, settledOn: string = today, allocation?: AllocationLine[]) {
    const target = entries.find((e) => e.id === id);
    if (target && needsAllocation(target.kind) && allocation === undefined) {
      setAllocateTarget(target);
      return;
    }
    settleGrace.current.add(id);
    setTimeout(() => settleGrace.current.delete(id), DOUBLE_TAP_MS);
    startTransition(async () => {
      patchOptimistic({ id, status: "settled", settledOn });
      const result = await settleEntryAction(id, settledOn, allocation);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => applyPatch(prev, { id, status: "settled", settledOn }));
      setRecent((prev) => new Set(prev).add(id));
      // Most things are paid today; the other day is offered right here, where the thumb already is (no press-and-hold needed).
      toast.success(settledOn === today ? "Settled" : `Settled on ${formatDate(settledOn)}`, {
        action: { label: "Undo", onClick: () => unsettle(id) },
        cancel: allocation ? undefined : { label: "Other day", onClick: () => setSettleOnTarget(entries.find((e) => e.id === id) ?? null) },
      });
    });
  }

  function unsettle(id: string) {
    // A double tap on ○ lands its second tap on the ✓ that replaced it: not a request to undo.
    if (settleGrace.current.has(id)) return;
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
      const total = entries.filter((e) => ids.includes(e.id)).reduce((sum, e) => sum + e.amountCents, 0);
      toast.success(`Settled ${ids.length} ${ids.length === 1 ? "entry" : "entries"} · ${formatBRL(total)}`, { action: { label: "Undo", onClick: () => unsettleMany(ids) } });
    });
  }

  function unsettleMany(ids: string[]) {
    startTransition(async () => {
      for (const id of ids) patchOptimistic({ id, status: "planned", settledOn: null });
      const result = await unsettleManyAction(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => ids.reduce((list, id) => applyPatch(list, { id, status: "planned", settledOn: null }), prev));
      setRecent((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      toast(`${ids.length} ${ids.length === 1 ? "entry is" : "entries are"} planned again`);
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
  // Card purchases are paid through their statement (§5.6), never settled here: they are not "to settle".
  // Contributions settle one by one, with their allocation (§5.2), so bulk settle leaves them out too.
  const plannedRows = optimistic.filter((e) => e.status === "planned" && lookups.accounts[e.accountId]?.type !== "credit_card" && !needsAllocation(e.kind));
  const plannedIds = plannedRows.map((e) => e.id);
  const plannedExpense = plannedRows.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amountCents, 0);
  // Bulk settle earns its control only when there is more than one thing to settle.
  const canSelect = selectable && plannedIds.length > 1;
  // Entries opens on what happened: the days after today fold into one row until asked for.
  const daysOf = (month: Period) => (ascending ? groupByDay(byMonth.get(month) ?? []).reverse() : groupByDay(byMonth.get(month) ?? []));
  const futureOf = (month: Period) => (collapseFuture ? daysOf(month).filter((d) => d.date > today) : []);
  const visibleDays = (month: Period) => (collapseFuture && !showFuture ? daysOf(month).filter((d) => d.date <= today) : daysOf(month));
  const futureSummary = (month: Period) => {
    const rows = futureOf(month).flatMap((d) => d.entries);
    const out = rows.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amountCents, 0);
    const last = futureOf(month).reduce((max, d) => (d.date > max ? d.date : max), today);
    return `${rows.length} after today, to ${formatDayMonth(last)}${out > 0 ? ` · ${formatBRL(out)} to pay` : ""}`;
  };

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      {(title || meta || canSelect) && (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-2 gap-y-1">
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
          ) : meta ? (
            meta
          ) : (
            <span />
          )}
          {canSelect && (
            <Button
              variant={selecting ? "secondary" : "ghost"}
              size="sm"
              className="h-11"
              aria-pressed={selecting}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              <CheckCheck data-icon="inline-start" aria-hidden />
              Settle several…
            </Button>
          )}
        </div>
      )}

      {settleHint && !hintDismissed && plannedIds.length > 0 && !selecting && (
        <p className="-mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="md:hidden">Tap ○ to settle today · hold it, or open the entry, for another day</span>
          <span className="hidden md:inline">○ settles today · the calendar picks the day (or Shift+Enter on ○)</span>
          <button type="button" onClick={() => dismissHint(() => true)} className="-mx-2 -my-3.5 inline-flex items-center px-2 py-3.5 font-medium text-foreground underline-offset-4 hover:underline">
            Got it
          </button>
        </p>
      )}

      {selecting && (
        <div
          role="toolbar"
          aria-label="Bulk settle"
          data-pinned-actions
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

      {optimistic.length === 0 && (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          {emptyAction}
        </div>
      )}

      {months.map((month) => (
        <section key={month}>
          {/* The month picker above already names the month being viewed; headers mark the earlier ones loaded below. */}
          {infinite && month !== period && (
            <h2 className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 text-sm font-semibold backdrop-blur md:-mx-8 md:px-8">
              {formatPeriodLong(month)}
            </h2>
          )}
          {futureOf(month).length > 0 && (
            <button
              type="button"
              aria-expanded={showFuture}
              onClick={() => setShowFuture((v) => !v)}
              className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-4 text-left text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/60"
            >
              <span>{futureSummary(month)}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", showFuture && "rotate-180")} aria-hidden />
            </button>
          )}
          <div className="space-y-3">
            {visibleDays(month).map((day) => (
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
                      onSettleOn={() => (needsAllocation(entry.kind) ? setAllocateTarget(entry) : setSettleOnTarget(entry))}
                      onUnsettle={() => unsettle(entry.id)}
                      statementLink={statementLink}
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
      <AllocateSheet entry={allocateTarget} today={today} onClose={() => setAllocateTarget(null)} onSettle={(id, date, allocation) => settle(id, date, allocation)} />

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
/** Movement before a touch counts as either a swipe or a scroll. */
const AXIS_SLOP = 10;
/** A tap on ✓ this soon after settling is the second half of a double tap. */
const DOUBLE_TAP_MS = 600;

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
  statementLink,
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
  statementLink: boolean;
}) {
  const accountRow = lookups.accounts[entry.accountId];
  // A card purchase is paid through its statement (§5.6): late only once that statement's due date passes, never settled one by one.
  const cycle =
    accountRow?.type === "credit_card" && accountRow.closingDay !== null && accountRow.dueDay !== null
      ? resolveCycle(accountRow.closingDay, accountRow.dueDay, entry.date)
      : null;
  const timing = cycle ? (entry.status === "settled" ? "settled" : cycle.dueDate < today ? "overdue" : "upcoming") : entryTiming(entry, today);
  // Income is received, everything else is paid.
  const settleVerb = (e: Entry) => (e.kind === "income" ? "Receive" : "Settle");
  const categoryRow = entry.categoryId ? lookups.categories[entry.categoryId] : undefined;
  const category = categoryRow?.name ?? null;
  const account = accountRow?.name ?? "?";
  const counter = entry.counterAccountId ? lookups.accounts[entry.counterAccountId]?.name : null;
  const parts = installmentLabel(entry);
  const meta = [parts, category, counter ? `${account} → ${counter}` : account].filter(Boolean).join(" · ");
  const amountText = formatBRL(entry.amountCents);

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
  const startY = useRef<number | null>(null);
  // Undecided until the finger moves: "x" drags the row, "y" leaves the page to scroll.
  const axis = useRef<"x" | "y" | null>(null);

  function resetSwipe() {
    setDx(0);
    startX.current = null;
    startY.current = null;
    axis.current = null;
  }
  function onTouchStart(e: React.TouchEvent) {
    if (selecting || e.touches.length > 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return;
    // A second finger (pinch, zoom) is never a swipe.
    if (e.touches.length > 1) {
      resetSwipe();
      return;
    }
    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(deltaX) < AXIS_SLOP && Math.abs(deltaY) < AXIS_SLOP) return;
      // Sideways has to clearly win: a diagonal scroll must never settle or open a row.
      axis.current = Math.abs(deltaX) > Math.abs(deltaY) * 2 ? "x" : "y";
      // Either way the finger is moving: no longer a press-and-hold on the circle.
      pressEnd();
    }
    if (axis.current !== "x") return;
    if (deltaX > 0 && (entry.status !== "planned" || cycle)) return;
    setDx(Math.max(-120, Math.min(120, deltaX)));
  }
  function onTouchEnd() {
    if (axis.current === "x") {
      if (dx >= SWIPE_THRESHOLD && entry.status === "planned" && !cycle) onSettle();
      else if (dx <= -SWIPE_THRESHOLD) router.push(editHref);
    }
    resetSwipe();
  }

  // Under large text the row is narrow in rem: the amount moves under the description and the category disc steps aside.
  return (
    <li className="@container relative overflow-hidden">
      {dx !== 0 && (
        <div
          className={cn(
            "absolute inset-y-0 flex items-center px-4 text-xs font-medium",
            dx > 0 ? "left-0 text-foreground" : "right-0 text-muted-foreground",
          )}
          aria-hidden
        >
          {dx > 0 ? "Settle" : "Edit"}
        </div>
      )}
      <div
        className={cn("relative flex min-h-14 touch-pan-y items-center gap-2 bg-card pr-2 pl-3 transition-transform", entry.status === "settled" && "opacity-70")}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={resetSwipe}
      >
        {selecting && (
          <span className="flex size-11 items-center justify-center">
            <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${entry.description}`} disabled={entry.status === "settled" || cycle !== null || needsAllocation(entry.kind)} />
          </span>
        )}
        {!selecting && (
          <CategoryIcon
            icon={categoryRow?.icon ?? (entry.kind === "transfer" ? "landmark" : needsAllocation(entry.kind) ? "piggy-bank" : null)}
            color={categoryRow?.color ?? null}
            name={category}
            size="sm"
            className="@max-[17.5rem]:hidden"
          />
        )}
        <Link
          href={editHref}
          onClick={(e) => {
            if (selecting) {
              e.preventDefault();
              if (entry.status === "planned" && !cycle && !needsAllocation(entry.kind)) onToggle();
            }
          }}
          className="flex min-w-0 flex-1 flex-col justify-center py-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{entry.description}</span>
            {timing === "overdue" && (
              <span className="shrink-0 rounded-full bg-negative/10 px-1.5 py-0.5 text-xs font-semibold text-negative uppercase">
                {entry.kind === "income" ? "late" : "overdue"}
              </span>
            )}
            {timing === "settled" && justSettled && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground uppercase">
                {entry.kind === "income" ? "received" : "paid"}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground md:text-sm">{meta}</span>
          <span className="sr-only @max-[17.5rem]:hidden">, {amountText}</span>
          <Amount kind={entry.kind} cents={entry.amountCents} className="hidden text-sm font-semibold @max-[17.5rem]:block" />
        </Link>
        <Amount kind={entry.kind} cents={entry.amountCents} className="shrink-0 text-sm font-semibold @max-[17.5rem]:hidden" />
        {!selecting && cycle && statementLink && (
          <Link
            href={`/cards?card=${entry.accountId}`}
            aria-label={`On the ${account} ${formatPeriodShort(periodOf(cycle.cycleEnd))} statement, due ${formatDayMonth(cycle.dueDate)}`}
            title={`On the ${formatPeriodShort(periodOf(cycle.cycleEnd))} card statement`}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-muted-foreground tabular-nums transition-colors hover:bg-muted hover:text-foreground"
          >
            <CreditCard className="size-3.5" aria-hidden />
            {formatPeriodShort(periodOf(cycle.cycleEnd))}
          </Link>
        )}
        {!selecting &&
          !cycle &&
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
                aria-label={`${settleVerb(entry)} ${entry.description}, ${amountText}${timing === "overdue" ? ", overdue" : ""}, today`}
                title={`${settleVerb(entry)} today · Shift+Enter for another day`}
                className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring @lg:px-3"
              >
                <Circle className="size-5" aria-hidden />
                {/* The label, the calendar and the pencil need room: they follow the row's width (a container), not the screen's. */}
                <span className="hidden text-sm font-medium @lg:inline">{settleVerb(entry)}</span>
              </button>
              <button
                type="button"
                onClick={onSettleOn}
                aria-label={`${settleVerb(entry)} ${entry.description} on another day`}
                title="Pick the day"
                className="hidden size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring @lg:flex"
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
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Check className="size-5" aria-hidden />
            </button>
          ))}
        <Link href={editHref} aria-label={`Edit ${entry.description}`} className="hidden size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground @lg:flex">
          <Pencil className="size-4" aria-hidden />
        </Link>
      </div>
    </li>
  );
}
