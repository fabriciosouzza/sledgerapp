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
  onBlur,
  "aria-describedby": describedBy,
}: {
  name: string;
  id?: string;
  defaultCents?: number | null;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  onCentsChange?: (cents: number | null) => void;
  onBlur?: () => void;
  "aria-describedby"?: string;
}) {
  const [cents, setCents] = useState<number | null>(defaultCents ?? null);

  function update(next: string) {
    const digits = next.replace(/\D/g, "");
    const value = digits === "" ? null : digitsToCents(digits);
    setCents(value);
    onCentsChange?.(value);
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
        value={cents === null ? "" : formatBRL(cents)}
        onChange={(e) => update(e.target.value)}
        onPaste={paste}
        onFocus={(e) => e.target.select()}
        onBlur={onBlur}
        required={required}
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        className={className}
      />
      <input type="hidden" name={name} value={submitted} />
    </>
  );
}
