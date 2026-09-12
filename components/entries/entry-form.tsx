"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { createEntryAction } from "@/app/(app)/add/actions";
import { updateEntryAction } from "@/app/(app)/entries/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/forms/date-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { appliesToKind } from "@/lib/domain/categories";
import { formatPeriodShort, periodOf } from "@/lib/domain/dates";
import { canBeInstallments, ENTRY_KINDS, needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { lastInstallmentPeriod } from "@/lib/domain/installments";
import { formatBRL } from "@/lib/domain/money";
import type { Account, Category, Entry, EntryKind } from "@/lib/domain/types";
import type { EntrySuggestions } from "@/lib/services/suggestions";
import { cn } from "@/lib/utils";

const MEMORY_KEY = "sledger.lastUsed";

type Memory = Partial<Record<EntryKind, { categoryId?: string; accountId?: string; counterAccountId?: string; settled?: boolean }>>;

interface SessionRow {
  id: string;
  kind: EntryKind;
  description: string;
  amountCents: number;
  count: number;
}

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
  today,
  entry,
  defaultKind,
  suggestions,
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
  /** Present when editing. */
  entry?: Entry;
  /** Pre-selected kind (from the add sheet). */
  defaultKind?: EntryKind;
  /** Recent descriptions and most-used categories (add only). */
  suggestions?: EntrySuggestions;
}) {
  const router = useRouter();
  const editing = entry !== undefined;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formKey, setFormKey] = useState(0);

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? defaultKind ?? "expense");
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [accountId, setAccountId] = useState(entry?.accountId ?? accounts[0]?.id ?? "");
  const [counterAccountId, setCounterAccountId] = useState(entry?.counterAccountId ?? "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [amountCents, setAmountCents] = useState<number | null>(entry?.amountCents ?? null);
  // null until the user touches the switch: the default then follows memory and the date.
  const [settledChoice, setSettledChoice] = useState<boolean | null>(entry ? entry.status === "settled" : null);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [added, setAdded] = useState<SessionRow[]>([]);
  const [installments, setInstallments] = useState(false);
  const [parts, setParts] = useState(12);
  const [repeat, setRepeat] = useState(false);
  const [scope, setScope] = useState<"this" | "this_and_future" | "all">("this");

  // Remember the last category and account per kind (§7 /add). localStorage
  // is an external store; the server snapshot is empty so hydration matches.
  const memoryRaw = useSyncExternalStore(subscribeMemory, readMemoryRaw, () => null);
  const remembered = editing ? undefined : parseMemory(memoryRaw)[kind];

  // What you just paid is the common case: on by default for dates up to today, and the last choice sticks per kind.
  const settled = settledChoice ?? (date <= today && (remembered?.settled ?? true));

  const kindCategories = categories.filter((c) => appliesToKind(c, kind));
  const kindSuggestions = editing ? [] : (suggestions?.descriptions[kind] ?? []);
  const topCategories = editing ? [] : (suggestions?.topCategories[kind] ?? []).map((id) => kindCategories.find((c) => c.id === id)).filter((c) => c !== undefined);
  const effectiveCategoryId = pick(categoryId, remembered?.categoryId, kindCategories);
  const effectiveAccountId = pick(accountId, remembered?.accountId, accounts);
  const counterOptions = accounts.filter((a) => a.id !== effectiveAccountId && (kind !== "contribution" || a.type === "brokerage"));
  const effectiveCounterId = pick(counterAccountId, remembered?.counterAccountId, counterOptions);

  const showInstallments = !editing && canBeInstallments(kind);
  const onCard = canBeInstallments(kind) && accounts.find((a) => a.id === effectiveAccountId)?.type === "credit_card";
  const preview =
    installments && amountCents
      ? `${parts} × ${formatBRL(amountCents)}, ${formatPeriodShort(periodOf(date))} → ${formatPeriodShort(lastInstallmentPeriod(date, parts))}`
      : null;

  /** Typing a known description brings back the category and accounts used with it last time. */
  function applyDescription(value: string) {
    setDescription(value);
    const match = kindSuggestions.find((s) => s.description.toLowerCase() === value.trim().toLowerCase());
    if (!match) return;
    if (match.categoryId) setCategoryId(match.categoryId);
    setAccountId(match.accountId);
    if (match.counterAccountId) setCounterAccountId(match.counterAccountId);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    startTransition(async () => {
      if (editing) {
        const result = await updateEntryAction(formData);
        if (!result.ok) return setError(result.error);
        toast.success(result.count > 1 ? `Updated ${result.count} entries` : "Updated");
        router.push("/entries");
        return;
      }
      const result = await createEntryAction(formData);
      if (!result.ok) return setError(result.error);
      writeMemory(kind, { categoryId: effectiveCategoryId, accountId: effectiveAccountId, counterAccountId: effectiveCounterId, settled });
      setAdded((prev) => [{ id: result.firstId, kind, description, amountCents: amountCents ?? 0, count: result.count }, ...prev]);
      toast.success(
        result.recurrence ? "Recurrence created" : result.count > 1 ? `${result.count} installments created` : "Saved",
      );
      setAmountCents(null);
      setDescription("");
      setInstallments(false);
      setRepeat(false);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-5">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <input type="hidden" name="kind" value={kind} />
      <FormError message={error} />

      <div role="radiogroup" aria-label="Kind" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {ENTRY_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              "h-10 rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:text-sm",
              kind === k.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Field label="Amount" htmlFor="amountCents">
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="date">
          <DatePicker id="date" name="date" required value={date} onChange={(v) => v && setDate(v)} />
        </Field>
        {needsCategory(kind) ? (
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
              {kindCategories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.parentId ? `· ${c.name}` : c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <div />
        )}
      </div>
      {topCategories.length > 1 && (
        <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Most used categories">
          {topCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              aria-pressed={effectiveCategoryId === c.id}
              className={cn(
                "h-8 rounded-full border px-3 text-xs transition-colors",
                effectiveCategoryId === c.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={needsCounterAccount(kind) ? "From" : "Account"} htmlFor="accountId">
          <NativeSelect id="accountId" name="accountId" value={effectiveAccountId} onChange={(e) => setAccountId(e.target.value)} required className="w-full [&>select]:h-11">
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {needsCounterAccount(kind) ? (
          <Field label="To" htmlFor="counterAccountId">
            <NativeSelect
              id="counterAccountId"
              name="counterAccountId"
              value={effectiveCounterId}
              onChange={(e) => setCounterAccountId(e.target.value)}
              required
              className="w-full [&>select]:h-11"
            >
              {counterOptions.length === 0 && (
                <NativeSelectOption value="">{kind === "contribution" ? "Add a brokerage account" : "No other account"}</NativeSelectOption>
              )}
              {counterOptions.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <div />
        )}
      </div>

      <Field label="Description" htmlFor="description">
        <Input
          id="description"
          name="description"
          required
          maxLength={120}
          value={description}
          onChange={(e) => applyDescription(e.target.value)}
          className="h-11"
          autoComplete="off"
          list={kindSuggestions.length > 0 ? "description-suggestions" : undefined}
        />
        {kindSuggestions.length > 0 && (
          <datalist id="description-suggestions">
            {kindSuggestions.map((s) => (
              <option key={s.description} value={s.description} />
            ))}
          </datalist>
        )}
      </Field>

      {onCard && !editing ? (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          On a card, the purchase counts the day it is made; you pay the statement later. Installments count when their statement is paid.
        </p>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="settled">{kind === "income" ? "Already received?" : "Already paid?"}</Label>
          <Switch id="settled" name="settled" checked={settled} onCheckedChange={setSettledChoice} />
        </div>
      )}
      {settled && !(onCard && !editing) && (
        <Field label={kind === "income" ? "Received on" : "Paid on"} htmlFor="settledOn">
          <DatePicker id="settledOn" name="settledOn" defaultValue={entry?.settledOn ?? (date <= today ? date : today)} />
        </Field>
      )}

      {showInstallments && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-4">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="installments">Installments</Label>
            <Switch id="installments" name="installments" checked={installments} onCheckedChange={(v) => { setInstallments(v); if (v) setRepeat(false); }} />
          </div>
          {installments && (
            <>
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

      <Field label="Notes" htmlFor="notes" hint="Optional.">
        <Textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={entry?.notes ?? ""} aria-describedby="notes-hint" />
      </Field>

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
              <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="size-4 accent-primary" />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Save"}
      </Button>

      {added.length > 0 && (
        <section aria-label="Added now" className="rounded-xl bg-muted/40 p-3">
          <h2 className="mb-1 text-xs font-medium text-muted-foreground">Added now · {added.length}</h2>
          <ul className="divide-y divide-border">
            {added.map((row) => (
              <li key={row.id}>
                <Link href={`/entries/${row.id}`} className="flex min-h-10 items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {row.description}
                    {row.count > 1 && <span className="text-muted-foreground"> · {row.count}×</span>}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", row.kind === "income" ? "text-emerald-600 dark:text-emerald-400" : row.kind === "expense" ? "text-red-600 dark:text-red-400" : "")}>
                    {row.kind === "expense" ? "-" : row.kind === "income" ? "+" : ""}
                    {formatBRL(row.amountCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
