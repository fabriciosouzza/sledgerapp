import type { Account, Category, Entry } from "@/lib/domain/types";

/** `1234,56` — what a Brazilian spreadsheet reads as a number. */
function amount(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, "0")}`;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADER = ["date", "settled_on", "kind", "status", "amount", "description", "category", "parent_category", "account", "counter_account", "installment", "notes"];

/**
 * Entries as a flat CSV: names instead of ids, `;` as separator and a BOM, so
 * Google Sheets and Excel in pt-BR open it without an import dialog.
 */
export function entriesCsv(entries: Entry[], accounts: Account[], categories: Category[]): string {
  const account = new Map(accounts.map((a) => [a.id, a.name]));
  const category = new Map(categories.map((c) => [c.id, c]));
  const rows = entries.map((e) => {
    const cat = e.categoryId ? category.get(e.categoryId) : undefined;
    const parent = cat?.parentId ? category.get(cat.parentId) : undefined;
    return [
      e.date,
      e.settledOn,
      e.kind,
      e.status,
      amount(e.kind === "expense" ? -e.amountCents : e.amountCents),
      e.description,
      cat?.name ?? null,
      parent?.name ?? null,
      account.get(e.accountId) ?? null,
      e.counterAccountId ? (account.get(e.counterAccountId) ?? null) : null,
      e.installmentNo !== null ? `${e.installmentNo}/${e.installmentTotal}` : null,
      e.notes,
    ]
      .map(cell)
      .join(";");
  });
  return `﻿${[HEADER.join(";"), ...rows].join("\r\n")}\r\n`;
}
