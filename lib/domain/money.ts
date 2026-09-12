// Money is integer cents; `kind` carries the sign (PROMPT.md §5.1).

import type { EntryKind } from "./types";

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Guarded division: `null` when the denominator is zero, rendered as `—`. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Effect of an entry on cash. Contributions and transfers are neutral to
 * income/expense metrics, so they carry no sign here (§5.2).
 */
export function cashFlowSign(kind: EntryKind): 1 | -1 | 0 {
  switch (kind) {
    case "income":
      return 1;
    case "expense":
      return -1;
    case "contribution":
    case "transfer":
      return 0;
  }
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const brlWhole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** `1393800` → `R$ 13.938`: for glances where the split matters, not the cents. */
export function formatBRLWhole(cents: number): string {
  return brlWhole.format(Math.round(cents / 100));
}

/** `123456` → `R$ 1.234,56`. Negative cents render with a leading minus. */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * The currency mask: the user types digits and each keystroke is one more
 * cent — `14990` displays as `R$ 149,90`. Non-digits are ignored.
 */
export function digitsToCents(digits: string): number {
  const clean = digits.replace(/\D/g, "");
  return clean === "" ? 0 : Number.parseInt(clean, 10);
}

/**
 * Parse a pasted or typed pt-BR amount: `1.234,56` → `123456`, `149,90` →
 * `14990`, `150` → `15000`. Returns `null` when the text is not an amount.
 */
export function parseBRL(text: string): number | null {
  const clean = text.replace(/[R$\s ]/g, "");
  if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(clean)) {
    return null;
  }
  const negative = clean.startsWith("-");
  const [whole, frac = ""] = clean.replace("-", "").replace(/\./g, "").split(",");
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(frac.padEnd(2, "0"), 10);
  return negative ? -cents : cents;
}

/**
 * Split a total into `parts` whole-cent amounts that add up exactly; the
 * remainder goes to the first part, as card issuers do.
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError("parts must be >= 1");
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => (i === 0 ? base + remainder : base));
}
