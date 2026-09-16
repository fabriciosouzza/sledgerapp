"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordBatchAction } from "@/app/(app)/portfolio/actions";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { DatePicker } from "@/components/forms/date-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useLocalMemory } from "@/lib/client/local-memory";
import { assetLabel } from "@/lib/domain/assets";
import { formatBRL } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

type Mode = "amount" | "balance";
type Kind = "yield" | "market_adjustment";

export function RecordBatchForm({ assets, today }: { assets: { id: string; name: string; broker: string | null; balanceCents: number }[]; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  // The way you did it last month is the way you do it this month.
  const [memory, remember] = useLocalMemory<{ mode?: Mode; kind?: Kind }>("sledger.recordMonth", {});
  const [modeChoice, setModeChoice] = useState<Mode | null>(null);
  const [kindChoice, setKindChoice] = useState<Kind | null>(null);
  const mode = modeChoice ?? memory.mode ?? "amount";
  const kind = kindChoice ?? memory.kind ?? "yield";
  const setMode = (m: Mode) => {
    setModeChoice(m);
    remember((c) => ({ ...c, mode: m }));
  };
  const setKind = (k: Kind) => {
    setKindChoice(k);
    remember((c) => ({ ...c, kind: k }));
  };
  const [typed, setTyped] = useState<Record<string, number | null>>({});

  const filled = assets.filter((a) => typed[a.id] !== null && typed[a.id] !== undefined);
  const delta = (a: { id: string; balanceCents: number }) => {
    const v = typed[a.id];
    if (v === null || v === undefined) return null;
    return mode === "balance" ? v - a.balanceCents : v;
  };
  const negatives = filled.filter((a) => (delta(a) ?? 0) < 0).length;
  // A "yield" as large as the balance is almost certainly the balance itself.
  const looksLikeBalance = mode === "amount" ? filled.filter((a) => a.balanceCents > 0 && (typed[a.id] ?? 0) >= a.balanceCents).length : 0;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await recordBatchAction(formData);
      if (!result.ok) return setError(result.error);
      toast.success(result.count === 0 ? "Nothing changed" : `Recorded ${result.count} ${result.count === 1 ? "movement" : "movements"}`);
      router.push("/portfolio");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />

      <div role="radiogroup" aria-label="What you are typing" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["amount", "The yield of each asset"],
            ["balance", "The balance at the broker"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "h-10 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:text-sm",
              mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="mode" value={mode} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Record as" htmlFor="kind" hint={kind === "yield" ? "Interest, dividends. Cannot be negative." : "Price moved; may be negative."}>
          <NativeSelect id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="w-full [&>select]:h-11" aria-describedby="kind-hint">
            <NativeSelectOption value="yield">Yield</NativeSelectOption>
            <NativeSelectOption value="market_adjustment">Market adjustment</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="Date" htmlFor="date">
          <DatePicker id="date" name="date" required defaultValue={today} />
        </Field>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {assets.map((a) => {
          const d = delta(a);
          return (
            <li key={a.id} className="grid grid-cols-[1fr_9rem] items-center gap-3 px-3 py-2">
              <label htmlFor={`amount-${a.id}`} className="min-w-0">
                <span className="block truncate text-sm font-medium">{assetLabel(a)}</span>
                <span className={cn("block text-xs tabular-nums text-muted-foreground", d !== null && d < 0 && "text-negative")}>
                  {d === null
                    ? `recorded ${formatBRL(a.balanceCents)}`
                    : mode === "amount"
                      ? `${formatBRL(a.balanceCents)} → ${formatBRL(a.balanceCents + d)} after`
                      : d === 0
                        ? "same as recorded"
                        : `${d > 0 ? "+" : "−"}${formatBRL(Math.abs(d))} vs ${formatBRL(a.balanceCents)}${kind === "yield" && d < 0 ? " · recorded as a market adjustment" : ""}`}
                </span>
              </label>
              <CurrencyInput id={`amount-${a.id}`} name={`amount:${a.id}`} onCentsChange={(v) => setTyped((t) => ({ ...t, [a.id]: v }))} className="h-11" />
            </li>
          );
        })}
      </ul>

      {kind === "yield" && negatives > 0 && (
        <p className="text-sm text-muted-foreground">
          {negatives} {negatives === 1 ? "line goes" : "lines go"} down: {negatives === 1 ? "it is" : "they are"} recorded as a market adjustment, not a negative yield.
        </p>
      )}
      {looksLikeBalance > 0 && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
          {looksLikeBalance === 1 ? "One line is" : `${looksLikeBalance} lines are`} as large as the recorded balance. If you typed what the broker shows, switch to “The balance at the broker” — otherwise the balance doubles.
        </p>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending || filled.length === 0 || looksLikeBalance > 0}>
        {pending ? "Saving…" : `Record ${filled.length} ${filled.length === 1 ? "movement" : "movements"}`}
      </Button>
    </form>
  );
}
