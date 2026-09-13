"use client";

import { useState } from "react";
import { digitsToCents, formatBRL, parseBRL } from "@/lib/domain/money";
import { Input } from "@/components/ui/input";

/**
 * The currency mask (PROMPT.md §8): every digit typed is one more cent, shown
 * as `R$ 1.234,56`. Submits the amount as `1234,56` under `name`, which the
 * form schemas parse back to cents; empty submits nothing.
 */
export function CurrencyInput({
  name,
  id,
  defaultCents,
  required,
  autoFocus,
  className,
  onCentsChange,
  "aria-describedby": describedBy,
}: {
  name: string;
  id?: string;
  defaultCents?: number | null;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  onCentsChange?: (cents: number | null) => void;
  "aria-describedby"?: string;
}) {
  const [cents, setCents] = useState<number | null>(defaultCents ?? null);

  // Every digit is a cent ("81233" → R$ 812,33). Typing a comma switches to
  // plain amounts: "812," then "33" reads as R$ 812,33 until the field blurs.
  const [raw, setRaw] = useState<string | null>(null);
  function update(next: string) {
    if (raw !== null) {
      const text = next.replace(/[^\d.,]/g, "");
      const parsed = parseBRL(text);
      setRaw(text);
      const value = parsed === null ? null : Math.abs(parsed);
      setCents(value);
      onCentsChange?.(value);
      return;
    }
    const digits = next.replace(/\D/g, "");
    const value = digits === "" ? null : digitsToCents(digits);
    setCents(value);
    onCentsChange?.(value);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "," || e.key === ".") && raw === null) {
      e.preventDefault();
      setRaw(`${cents ?? ""},`);
    }
  }

  function paste(e: React.ClipboardEvent<HTMLInputElement>) {
    const parsed = parseBRL(e.clipboardData.getData("text"));
    if (parsed !== null) {
      e.preventDefault();
      setCents(Math.abs(parsed));
      onCentsChange?.(Math.abs(parsed));
    }
  }

  const submitted = cents === null ? "" : `${Math.floor(cents / 100)},${(cents % 100).toString().padStart(2, "0")}`;

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={raw ?? (cents === null ? "" : formatBRL(cents))}
        onChange={(e) => update(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setRaw(null)}
        onPaste={paste}
        onFocus={(e) => e.target.select()}
        required={required}
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        className={className}
      />
      <input type="hidden" name={name} value={submitted} />
    </>
  );
}
