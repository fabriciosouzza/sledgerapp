"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { createEntryAction } from "@/app/(app)/add/actions";
import { deleteEntryAction, updateEntryAction } from "@/app/(app)/entries/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/forms/date-picker";
import { FormError } from "@/components/forms/form-error";
import { PageHeader } from "@/components/layout/page-header";
import { AllocationFields } from "@/components/portfolio/allocation-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { appliesToKind } from "@/lib/domain/categories";
import { formatPeriodShort, periodOf } from "@/lib/domain/dates";
import { canBeInstallments, ENTRY_KINDS, entryKindLabel, isMove, needsAllocation, needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { lastInstallmentPeriod } from "@/lib/domain/installments";
import { formatBRL } from "@/lib/domain/money";
import type { Account, AllocationLine, Asset, Category, Entry, EntryKind } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const MEMORY_KEY = "sledger.lastUsed";

type Memory = Partial<Record<EntryKind, { categoryId?: string; accountId?: string; counterAccountId?: string; settled?: boolean }>>;

function parseMemory(raw: string | null): Memory {
  try {
    return raw ? (JSON.parse(raw) as Memory) : {};
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();
function subscribeMemory(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function readMemoryRaw(): string | null {
  try {
    return localStorage.getItem(MEMORY_KEY);
  } catch {
    return null;
  }
}
function writeMemory(kind: EntryKind, value: Memory[EntryKind]) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...parseMemory(readMemoryRaw()), [kind]: value }));
    for (const cb of listeners) cb();
  } catch {
    // Storage unavailable: nothing to remember.
  }
}

/** The chosen id when it is valid for the current kind, else the remembered one, else the first option. */
function pick<T extends { id: string }>(chosen: string, remembered: string | undefined, options: T[]): string {
  if (options.some((o) => o.id === chosen)) return chosen;
  if (remembered && options.some((o) => o.id === remembered)) return remembered;
  return options[0]?.id ?? "";
}

export function EntryForm({
  accounts,
  categories,
  assets,
  today,
  entry,
  allocation,
  defaultKind,
}: {
  accounts: Account[];
  categories: Category[];
  /** Active assets, for where a settled contribution goes (§5.2). */
  assets: Asset[];
  today: string;
  /** Present when editing. */
  entry?: Entry;
  /** When editing a settled contribution: where it went. */
  allocation?: AllocationLine[];
  /** Pre-selected kind (from the add sheet). */
  defaultKind?: EntryKind;
}) {
  const router = useRouter();
  const editing = entry !== undefined;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formKey, setFormKey] = useState(0);

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? defaultKind ?? "expense");
  // Chosen in the add sheet already: the title confirms it and Change brings the control back (DESIGN.md, 2026-09-14).
  const [kindLocked, setKindLocked] = useState(!editing && defaultKind !== undefined);
  const kindGroupRef = useRef<HTMLDivElement>(null);
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [accountId, setAccountId] = useState(entry?.accountId ?? accounts[0]?.id ?? "");
  const [counterAccountId, setCounterAccountId] = useState(entry?.counterAccountId ?? "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [amountCents, setAmountCents] = useState<number | null>(entry?.amountCents ?? null);
  // null until the user touches the switch: the default then follows memory and the date.
  const [settledChoice, setSettledChoice] = useState<boolean | null>(entry ? entry.status === "settled" : null);
  const [installments, setInstallments] = useState(false);
  const [parts, setParts] = useState(12);
  const [firstNo, setFirstNo] = useState(1);
  const [variable, setVariable] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [scope, setScope] = useState<"this" | "this_and_future" | "all">("this");
  const [hasNotes, setHasNotes] = useState(Boolean(entry?.notes));
  const [moreOpen, setMoreOpen] = useState(Boolean(entry?.notes));

  // Remember the last category and account per kind (§7 /add). localStorage
  // is an external store; the server snapshot is empty so hydration matches.
  const memoryRaw = useSyncExternalStore(subscribeMemory, readMemoryRaw, () => null);
  const remembered = editing ? undefined : parseMemory(memoryRaw)[kind];

  // What you just paid is the common case: on by default for dates up to today, and the last choice sticks per kind.
  const settled = settledChoice ?? (date <= today && (remembered?.settled ?? true));

  const kindCategories = categories.filter((c) => appliesToKind(c, kind));
  // Nothing remembered: start blank and required, so a quick Enter never files a receipt under whatever came first.
  const effectiveCategoryId = kindCategories.some((c) => c.id === categoryId)
    ? categoryId
    : remembered?.categoryId && kindCategories.some((c) => c.id === remembered.categoryId)
      ? remembered.categoryId
      : "";
  // A contribution leaves cash, never a card (§5.2).
  const accountOptions = needsAllocation(kind) ? accounts.filter((a) => a.type !== "credit_card") : accounts;
  const effectiveAccountId = pick(accountId, remembered?.accountId, accountOptions);
  const counterOptions = accounts.filter((a) => a.id !== effectiveAccountId);
  const effectiveCounterId = pick(counterAccountId, remembered?.counterAccountId, counterOptions);

  const showInstallments = !editing && canBeInstallments(kind);
  const onCard = canBeInstallments(kind) && accounts.find((a) => a.id === effectiveAccountId)?.type === "credit_card";
  const remaining = parts - firstNo + 1;
  const preview =
    installments && amountCents
      ? `${firstNo > 1 ? `${firstNo}/${parts} → ${parts}/${parts}` : `${parts} × ${formatBRL(amountCents)}`}, ${formatPeriodShort(periodOf(date))} → ${formatPeriodShort(lastInstallmentPeriod(date, parts, firstNo))} · ${formatBRL(amountCents * remaining)} ${firstNo > 1 ? "still to go" : "in total"}`
      : null;

  const kindLabel = entryKindLabel(kind);
  // Where a settled contribution goes is part of the form; a planned one decides at settle time.
  const showAllocation = needsAllocation(kind) && settled;
  const moreLabel = editing ? "Notes" : showInstallments ? "Installments, repeat, notes" : "Repeat monthly, notes";
  // What is switched on stays visible while the section is closed.
  const moreSummary = [
    installments ? `${parts} installments` : null,
    repeat ? `repeats monthly${variable ? ", amount varies" : ""}` : null,
    hasNotes && !editing ? "has a note" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function changeKind() {
    setKindLocked(false);
    // The control replaces the title's button: keep keyboard focus on the chosen kind, not the page.
    requestAnimationFrame(() => kindGroupRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    const categoryName = kindCategories.find((c) => c.id === effectiveCategoryId)?.name;
    const accountName = accounts.find((a) => a.id === effectiveAccountId)?.name;
    const counterName = needsCounterAccount(kind) ? accounts.find((a) => a.id === effectiveCounterId)?.name : undefined;
    if (showAllocation && assets.length === 0) return setError("Add an asset first: a contribution is never settled without a destination.");
    const where = [needsCategory(kind) ? categoryName : null, counterName ? `${accountName} → ${counterName}` : accountName].filter(Boolean).join(" · ");
    startTransition(async () => {
      if (editing) {
        const result = await updateEntryAction(formData);
        if (!result.ok) return setError(result.error);
        toast.success(result.count > 1 ? `Updated ${result.count} entries` : "Updated");
        // Back to wherever the row was tapped (Today, an account, a card), not always /entries.
        if (window.history.length > 1) router.back();
        else router.push("/entries");
        return;
      }
      const result = await createEntryAction(formData);
      if (!result.ok) return setError(result.error);
      writeMemory(kind, { categoryId: effectiveCategoryId, accountId: effectiveAccountId, counterAccountId: effectiveCounterId, settled });
      // Say what was saved, so a batch of receipts leaves a trace; Undo and Edit fix a slip without leaving the form.
      const what = `${result.description} · ${formatBRL(result.amountCents)}${where ? ` · ${where}` : ""}`;
      const firstId = result.firstId;
      const parts = result.count;
      toast.success(result.recurrence ? `Recurrence created: ${what}` : parts > 1 ? `${parts} installments: ${what} each` : `Saved ${what}`, {
        action:
          firstId && !result.recurrence
            ? {
                label: "Undo",
                onClick: async () => {
                  const data = new FormData();
                  data.set("id", firstId);
                  data.set("scope", parts > 1 ? "all" : "this");
                  const undone = await deleteEntryAction(data);
                  if (undone.error) toast.error(undone.error);
                  else toast(`Removed ${what}`);
                },
              }
            : undefined,
        cancel: firstId ? { label: "Edit", onClick: () => router.push(`/entries/${firstId}`) } : undefined,
      });
      setAmountCents(null);
      setInstallments(false);
      setRepeat(false);
      setHasNotes(false);
      setMoreOpen(false);
      setFormKey((k) => k + 1);
    });
  }

  const accountField = (
    <Field label={needsCounterAccount(kind) || kind === "contribution" ? "From" : kind === "redemption" ? "To" : "Account"} htmlFor="accountId">
      <NativeSelect id="accountId" name="accountId" value={effectiveAccountId} onChange={(e) => setAccountId(e.target.value)} required className="w-full [&>select]:h-11">
        {accountOptions.map((a) => (
          <NativeSelectOption key={a.id} value={a.id}>
            {a.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  const dateField = (
    <Field label="Date" htmlFor="date">
      <DatePicker id="date" name="date" required value={date} onChange={(v) => v && setDate(v)} />
    </Field>
  );

  return (
    <>
      {!editing && (
        <PageHeader
          title={kindLocked ? `New ${kindLabel.toLowerCase()}` : "Add"}
          action={
            kindLocked ? (
              <Button type="button" variant="ghost" className="h-11" onClick={changeKind}>
                Change
              </Button>
            ) : undefined
          }
        />
      )}

      <form key={formKey} onSubmit={onSubmit} className="space-y-5 md:max-w-2xl">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <input type="hidden" name="kind" value={kind} />

        {!kindLocked && !(editing && entry?.installmentGroupId) && kind !== "redemption" && (
          <div
            ref={kindGroupRef}
            role="radiogroup"
            aria-label="Kind"
            onKeyDown={(e) => {
              // A radio group takes one Tab stop and moves with the arrow keys.
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (step === 0) return;
              e.preventDefault();
              const index = ENTRY_KINDS.findIndex((k) => k.value === kind);
              setKind(ENTRY_KINDS[(index + step + ENTRY_KINDS.length) % ENTRY_KINDS.length].value);
              requestAnimationFrame(() => kindGroupRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
            }}
            className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1"
          >
            {ENTRY_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                tabIndex={kind === k.value ? 0 : -1}
                onClick={() => setKind(k.value)}
                className={cn(
                  "h-11 rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:text-sm",
                  kind === k.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        )}

        <Field label={installments ? "Amount of each part" : "Amount"} htmlFor="amountCents">
          <CurrencyInput
            id="amountCents"
            name="amountCents"
            defaultCents={amountCents}
            onCentsChange={setAmountCents}
            required
            autoFocus
            className="h-14 text-2xl font-semibold"
          />
        </Field>

        {needsCounterAccount(kind) && (
          <div className="grid grid-cols-2 gap-3">
            {accountField}
            <Field label="To" htmlFor="counterAccountId">
              <NativeSelect
                id="counterAccountId"
                name="counterAccountId"
                value={effectiveCounterId}
                onChange={(e) => setCounterAccountId(e.target.value)}
                required
                className="w-full [&>select]:h-11"
              >
                {counterOptions.length === 0 && <NativeSelectOption value="">No other account</NativeSelectOption>}
                {counterOptions.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}

        {/* Straight after the amount: one typing path with the keyboard up, and Enter saves. */}
        <Field
          label="Description"
          htmlFor="description"
          hint={needsCounterAccount(kind) ? "Optional: blank means “From → To”." : needsAllocation(kind) ? `Optional: blank means “${kind === "redemption" ? "Resgate" : "Aporte"}” plus the asset.` : undefined}
        >
          <Input
            id="description"
            name="description"
            required={!isMove(kind)}
            maxLength={120}
            defaultValue={entry?.description}
            className="h-11"
            autoComplete="off"
            aria-describedby={isMove(kind) ? "description-hint" : undefined}
          />
        </Field>

        {needsCategory(kind) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="categoryId">
              <NativeSelect
                id="categoryId"
                name="categoryId"
                value={effectiveCategoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full [&>select]:h-11"
              >
                {kindCategories.length === 0 && <NativeSelectOption value="">No category applies</NativeSelectOption>}
                {kindCategories.length > 0 && effectiveCategoryId === "" && (
                  <NativeSelectOption value="" disabled>
                    Pick a category
                  </NativeSelectOption>
                )}
                {kindCategories.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.parentId ? `· ${c.name}` : c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {accountField}
          </div>
        )}
        {!needsCategory(kind) && !needsCounterAccount(kind) && accountField}


        {onCard ? (
          <div className="space-y-3">
            {dateField}
            <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              On a card, the purchase counts the day it is made; you pay the statement later. Installments count when their statement is paid.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor="settled">{kind === "income" || kind === "redemption" ? "Already received?" : kind === "contribution" ? "Already invested?" : "Already paid?"}</Label>
              <Switch id="settled" name="settled" checked={settled} onCheckedChange={setSettledChoice} />
            </div>
            <div className={cn("grid gap-3", settled && "grid-cols-2")}>
              {dateField}
              {settled && (
                <Field label={kind === "income" || kind === "redemption" ? "Received on" : "Paid on"} htmlFor="settledOn">
                  <DatePicker id="settledOn" name="settledOn" defaultValue={entry?.settledOn ?? (editing ? today : date <= today ? date : today)} />
                </Field>
              )}
            </div>
          </div>
        )}

        {showAllocation && (
          <div className="space-y-2 rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">{kind === "redemption" ? "Comes from" : "Goes to"}</p>
            <p className="text-xs text-muted-foreground">
              {kind === "redemption"
                ? "The assets this money came out of; the parts add up to the amount."
                : "The assets this money becomes; the parts add up to the amount. Split it however you like this time."}
            </p>
            <AllocationFields key={`${kind}-${assets.length}`} assets={assets} totalCents={amountCents} initial={allocation} verb={kind === "redemption" ? "comes from" : "goes to"} />
          </div>
        )}

        {editing && entry?.installmentGroupId && (
          <fieldset className="space-y-2 rounded-xl bg-muted/40 p-4">
            <legend className="px-1 text-sm font-medium">Apply to</legend>
            {(
              [
                ["this", `Only part ${entry.installmentNo}/${entry.installmentTotal}`],
                ["this_and_future", "This and future parts"],
                ["all", "All parts"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="size-5 accent-primary" />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        {/* Collapsed, the fields stay in the form (hidden, not removed), so nothing typed is lost on submit. */}
        <div className="border-t border-border pt-1">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="entry-more"
            onClick={() => setMoreOpen((open) => !open)}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{moreLabel}</span>
              {moreSummary && <span className="block truncate text-xs text-muted-foreground">{moreSummary}</span>}
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", moreOpen && "rotate-180")} aria-hidden />
          </button>

          <div id="entry-more" hidden={!moreOpen} className="space-y-5 pt-3">
            {showInstallments && (
              <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <Label htmlFor="installments">Installments</Label>
                  <Switch id="installments" name="installments" checked={installments} onCheckedChange={(v) => { setInstallments(v); if (v) setRepeat(false); }} />
                </div>
                {installments && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Parts" htmlFor="installmentParts">
                        <Input
                          id="installmentParts"
                          name="installmentParts"
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={120}
                          value={parts}
                          onChange={(e) => setParts(Math.max(2, Math.min(120, Number(e.target.value) || 2)))}
                          className="h-11"
                        />
                      </Field>
                      <Field label="This is part" htmlFor="installmentFirstNo" hint="Already under way? Start from this part.">
                        <Input
                          id="installmentFirstNo"
                          name="installmentFirstNo"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={parts}
                          value={firstNo}
                          onChange={(e) => setFirstNo(Math.max(1, Math.min(parts, Number(e.target.value) || 1)))}
                          className="h-11"
                          aria-describedby="installmentFirstNo-hint"
                        />
                      </Field>
                    </div>
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      {preview ?? "Type the amount of each part to preview."}
                    </p>
                  </>
                )}
              </div>
            )}

            {!editing && (
              <div className="flex min-h-11 items-center justify-between gap-3">
                <div>
                  <Label htmlFor="repeatMonthly">Repeat monthly</Label>
                  <p className="text-xs text-muted-foreground">Creates a recurrence on day {new Date(`${date}T00:00:00`).getDate() || "?"}.</p>
                </div>
                <Switch id="repeatMonthly" name="repeatMonthly" checked={repeat} onCheckedChange={(v) => { setRepeat(v); if (v) setInstallments(false); }} disabled={installments} />
              </div>
            )}
            {!editing && repeat && (
              <div className="-mt-2 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted/40 px-4">
                <div>
                  <Label htmlFor="variable">Amount varies each month</Label>
                  <p className="text-xs text-muted-foreground">Water, power: the amount typed now is only an estimate for later months.</p>
                </div>
                <Switch id="variable" name="variable" checked={variable} onCheckedChange={setVariable} />
              </div>
            )}

            <Field label="Notes" htmlFor="notes" hint="Optional.">
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={500}
                defaultValue={entry?.notes ?? ""}
                onChange={(e) => setHasNotes(e.target.value.trim() !== "")}
                aria-describedby="notes-hint"
              />
            </Field>
          </div>
        </div>

        {/* Save stays within reach above the bottom nav; a failed save says why right where it was tapped. */}
        <div data-pinned-actions className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-8 md:px-8">
          <FormError message={error} />
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Save"}
          </Button>
        </div>
      </form>
    </>
  );
}
