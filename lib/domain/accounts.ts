// Account rules (PROMPT.md §5.6): only a credit card carries cycle days and a
// limit; every other type must have them null. The database checks the same.

import type { Account, AccountType } from "./types";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "brokerage", label: "Brokerage" },
  { value: "other", label: "Other" },
];

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function isCreditCard(account: Pick<Account, "type">): boolean {
  return account.type === "credit_card";
}

/** Card debt is never cash (§5.6); brokerage balances come from movements (§5.7). Cash accounts carry a derived balance. */
export function isCashAccount(account: Pick<Account, "type">): boolean {
  return account.type === "checking" || account.type === "savings" || account.type === "cash" || account.type === "other";
}

export type AccountFields = Omit<Account, "id">;

/** Nulls the card-only fields on non-card accounts so a type change cannot leave stale days behind. */
export function normalizeAccountFields(fields: AccountFields): AccountFields {
  const target = fields.type === "savings" ? fields.targetCents : null;
  if (isCreditCard(fields)) return { ...fields, targetCents: null };
  return { ...fields, closingDay: null, dueDay: null, creditLimitCents: null, targetCents: target };
}
