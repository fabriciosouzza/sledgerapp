import type { AssetMovement, BalanceSnapshot, Entry, Recurrence } from "../types";

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export function entry(overrides: Partial<Entry> = {}): Entry {
  const settledOn = overrides.settledOn ?? (overrides.status === "settled" ? overrides.date ?? "2026-11-05" : null);
  return {
    id: nextId("entry"),
    date: "2026-11-05",
    settledOn,
    kind: "expense",
    status: settledOn ? "settled" : "planned",
    amountCents: 1000,
    description: "Teste",
    categoryId: "cat-outros",
    accountId: "acc-checking",
    counterAccountId: null,
    notes: null,
    source: "manual",
    recurrenceId: null,
    period: null,
    installmentGroupId: null,
    installmentNo: null,
    installmentTotal: null,
    statementId: null,
    ...overrides,
  };
}

export const settled = (overrides: Partial<Entry> = {}): Entry =>
  entry({ status: "settled", settledOn: overrides.date ?? "2026-11-05", ...overrides });

export function recurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    id: nextId("rec"),
    description: "Aluguel",
    kind: "expense",
    categoryId: "cat-moradia",
    accountId: "acc-checking",
    counterAccountId: null,
    amountCents: 150_000,
    dueDay: 10,
    startsOn: "2026-01-01",
    endsOn: null,
    isVariable: false,
    isActive: true,
    ...overrides,
  };
}

export function movement(overrides: Partial<AssetMovement> = {}): AssetMovement {
  return {
    id: nextId("mov"),
    assetId: "asset-cdb",
    date: "2026-11-05",
    kind: "contribution",
    amountCents: 100_000,
    entryId: null,
    notes: null,
    ...overrides,
  };
}

export function snapshot(overrides: Partial<BalanceSnapshot> = {}): BalanceSnapshot {
  return {
    id: nextId("snap"),
    period: "2026-11-01",
    accountId: "acc-checking",
    kind: "cash",
    amountCents: 500_000,
    ...overrides,
  };
}
