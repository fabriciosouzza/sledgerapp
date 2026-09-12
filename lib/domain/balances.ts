// Account balances are derived (DESIGN.md, decided 2026-09-13): an account
// starts at its opening balance on its opening date, and every settled entry
// since then moves it. Cards are debt (their statements, §5.6) and brokerages
// are investments (their movements, §5.7); only cash accounts have a balance
// here.

import { isCashAccount } from "./accounts";
import type { Account, Entry, IsoDate } from "./types";

/**
 * How a settled entry moves `accountId`: money leaves the source account and
 * arrives at the counter account. Contributions leave cash and land in a
 * brokerage, which is not a cash balance, so only the leaving side counts.
 */
export function entryEffectOn(entry: Pick<Entry, "kind" | "amountCents" | "accountId" | "counterAccountId">, accountId: string): number {
  let effect = 0;
  if (entry.accountId === accountId) {
    effect += entry.kind === "income" ? entry.amountCents : -entry.amountCents;
  }
  if (entry.counterAccountId === accountId && entry.kind === "transfer") {
    effect += entry.amountCents;
  }
  return effect;
}

/**
 * The balance at the end of `until`: opening balance plus every entry settled
 * from the opening date through `until`. `null` before the account existed.
 */
export function accountBalanceAt(
  account: Pick<Account, "id" | "type" | "openingBalanceCents" | "openingOn">,
  entries: Entry[],
  until: IsoDate,
): number | null {
  if (!isCashAccount(account)) return null;
  if (until < account.openingOn) return null;
  let balance = account.openingBalanceCents;
  for (const e of entries) {
    if (e.status !== "settled" || e.settledOn === null) continue;
    if (e.settledOn < account.openingOn || e.settledOn > until) continue;
    balance += entryEffectOn(e, account.id);
  }
  return balance;
}

export interface AccountBalance {
  account: Account;
  balanceCents: number | null;
}

export function balancesAt(accounts: Account[], entries: Entry[], until: IsoDate): AccountBalance[] {
  return accounts.filter(isCashAccount).map((account) => ({ account, balanceCents: accountBalanceAt(account, entries, until) }));
}

/** Σ cash balances known at `until`; `null` when no cash account exists yet. */
export function cashAt(accounts: Account[], entries: Entry[], until: IsoDate): number | null {
  const known = balancesAt(accounts, entries, until).filter((b): b is { account: Account; balanceCents: number } => b.balanceCents !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, b) => sum + b.balanceCents, 0);
}
