// Entry rules shared by the form, the list and the services (PROMPT.md §5.2–5.4).

import type { Entry, EntryKind, IsoDate } from "./types";

export const ENTRY_KINDS: { value: EntryKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "contribution", label: "Contribution" },
];

export function needsCategory(kind: EntryKind): boolean {
  return kind === "income" || kind === "expense";
}

export function needsCounterAccount(kind: EntryKind): boolean {
  return kind === "transfer" || kind === "contribution";
}

export function canBeInstallments(kind: EntryKind): boolean {
  return kind === "expense" || kind === "income";
}

/** How the amount reads in a list: signed for cash flow, neutral for moves between accounts. */
export function displaySign(kind: EntryKind): "+" | "-" | "" {
  switch (kind) {
    case "income":
      return "+";
    case "expense":
      return "-";
    case "transfer":
    case "contribution":
      return "";
  }
}

export function installmentLabel(entry: Pick<Entry, "installmentNo" | "installmentTotal">): string | null {
  return entry.installmentNo !== null && entry.installmentTotal !== null ? `${entry.installmentNo}/${entry.installmentTotal}` : null;
}

export interface DayGroup<T> {
  date: IsoDate;
  entries: T[];
}

/** Newest day first; keeps the order entries arrive in within a day. */
export function groupByDay<T extends Pick<Entry, "date">>(entries: T[]): DayGroup<T>[] {
  const groups = new Map<IsoDate, T[]>();
  for (const e of entries) {
    const list = groups.get(e.date) ?? [];
    list.push(e);
    groups.set(e.date, list);
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({ date, entries: list }));
}
