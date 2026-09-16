import { describe, expect, it } from "vitest";
import { accountBalanceAt, balancesAt, cashAt, entryEffectOn } from "../balances";
import type { Account } from "../types";
import { entry, settled } from "./fixtures";

const account = (overrides: Partial<Account> = {}): Account => ({
  id: "acc-checking",
  name: "Conta Corrente",
  type: "checking",
  institution: null,
  closingDay: null,
  dueDay: null,
  creditLimitCents: null,
  targetCents: null,
  openingBalanceCents: 100_000,
  openingOn: "2026-09-01",
  isActive: true,
  sortOrder: 0,
  ...overrides,
});

describe("entryEffectOn", () => {
  it("moves money out of the source and into a transfer's destination", () => {
    expect(entryEffectOn(settled({ kind: "income", amountCents: 500 }), "acc-checking")).toBe(500);
    expect(entryEffectOn(settled({ kind: "expense", amountCents: 500 }), "acc-checking")).toBe(-500);
    const transfer = settled({ kind: "transfer", amountCents: 300, counterAccountId: "acc-savings" });
    expect(entryEffectOn(transfer, "acc-checking")).toBe(-300);
    expect(entryEffectOn(transfer, "acc-savings")).toBe(300);
    // Acceptance 17: a contribution leaves cash and a redemption brings it back; the other side is an asset movement, not a cash balance.
    const contribution = settled({ kind: "contribution", amountCents: 200 });
    expect(entryEffectOn(contribution, "acc-checking")).toBe(-200);
    const redemption = settled({ kind: "redemption", amountCents: 150 });
    expect(entryEffectOn(redemption, "acc-checking")).toBe(150);
    expect(entryEffectOn(transfer, "acc-other")).toBe(0);
  });
});

describe("accountBalanceAt", () => {
  const entries = [
    settled({ kind: "income", amountCents: 50_000, date: "2026-09-05", settledOn: "2026-09-05" }),
    settled({ kind: "expense", amountCents: 12_000, date: "2026-09-10", settledOn: "2026-09-12" }),
    entry({ kind: "expense", amountCents: 99_999, date: "2026-09-11" }), // planned: not yet
    settled({ kind: "expense", amountCents: 999, date: "2026-08-20", settledOn: "2026-08-20" }), // before opening: inside the opening balance
    settled({ kind: "transfer", amountCents: 10_000, counterAccountId: "acc-savings", date: "2026-09-15", settledOn: "2026-09-15" }),
  ];

  it("starts at the opening balance and applies settled entries by their settled date", () => {
    expect(accountBalanceAt(account(), entries, "2026-09-11")).toBe(150_000);
    expect(accountBalanceAt(account(), entries, "2026-09-12")).toBe(138_000);
    expect(accountBalanceAt(account(), entries, "2026-09-30")).toBe(128_000);
  });

  // Acceptance 12, reinterpreted: before the account existed there is no number, never zero.
  it("is null before the opening date and for cards", () => {
    expect(accountBalanceAt(account(), entries, "2026-08-31")).toBeNull();
    expect(accountBalanceAt(account({ type: "credit_card", closingDay: 5, dueDay: 15 }), entries, "2026-09-30")).toBeNull();
  });

  it("sums cash across accounts, ignoring the ones that do not exist yet", () => {
    const accounts = [account(), account({ id: "acc-savings", type: "savings", openingBalanceCents: 0, openingOn: "2026-09-14" }), account({ id: "card", type: "credit_card", closingDay: 5, dueDay: 15 })];
    expect(cashAt(accounts, entries, "2026-09-13")).toBe(138_000);
    expect(cashAt(accounts, entries, "2026-09-30")).toBe(128_000 + 10_000);
    expect(cashAt(accounts, entries, "2026-08-01")).toBeNull();
    expect(balancesAt(accounts, entries, "2026-09-30")).toHaveLength(2);
  });
});
