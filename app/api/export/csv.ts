import type { Account, Asset, AssetMovement, Category, Entry } from "@/lib/domain/types";

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

const HEADER = ["date", "settled_on", "kind", "status", "amount", "description", "category", "parent_category", "account", "counter_account", "installment", "assets", "notes"];

/**
 * Entries as a flat CSV: names instead of ids, `;` as separator and a BOM, so
 * Google Sheets and Excel in pt-BR open it without an import dialog. A
 * contribution's other side is its assets (§5.2): "Tesouro Selic: 600,00 | Bitcoin: 400,00".
 */
export function entriesCsv(entries: Entry[], accounts: Account[], categories: Category[], assets: Asset[] = [], movements: AssetMovement[] = []): string {
  const account = new Map(accounts.map((a) => [a.id, a.name]));
  const category = new Map(categories.map((c) => [c.id, c]));
  const asset = new Map(assets.map((a) => [a.id, a.name]));
  const byEntry = new Map<string, AssetMovement[]>();
  for (const m of movements) if (m.entryId !== null) byEntry.set(m.entryId, [...(byEntry.get(m.entryId) ?? []), m]);
  const rows = entries.map((e) => {
    const cat = e.categoryId ? category.get(e.categoryId) : undefined;
    const parent = cat?.parentId ? category.get(cat.parentId) : undefined;
    const split = (byEntry.get(e.id) ?? []).map((m) => `${asset.get(m.assetId) ?? "?"}: ${amount(m.amountCents)}`).join(" | ");
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
      split || null,
      e.notes,
    ]
      .map(cell)
      .join(";");
  });
  return `﻿${[HEADER.join(";"), ...rows].join("\r\n")}\r\n`;
}
