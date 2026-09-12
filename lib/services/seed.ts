// Starting set for a new user (PROMPT.md §10): editable, no entries, no cards.
// Names are user data, hence Portuguese. Runs from the app after sign-up —
// never from a database trigger (§4.1) — and only for an empty user.

import type { AccountType } from "@/lib/domain/types";
import type { NewAccount, NewCategory, Repositories } from "@/lib/repositories";

const ACCOUNTS: { name: string; type: AccountType }[] = [
  { name: "Conta Corrente", type: "checking" },
  { name: "Dinheiro", type: "cash" },
  { name: "Reserva", type: "savings" },
  { name: "Corretora", type: "brokerage" },
];

export const SEED_ACCOUNTS: NewAccount[] = ACCOUNTS.map((a, i) => ({
  ...a,
  institution: null,
  closingDay: null,
  dueDay: null,
  creditLimitCents: null,
  isActive: true,
  sortOrder: i,
}));

const EXPENSE_CATEGORIES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Assinaturas",
  "Lazer",
  "Dívidas e parcelas",
];

export const SEED_CATEGORIES: NewCategory[] = [
  ...EXPENSE_CATEGORIES.map((name) => ({ name, appliesTo: ["expense" as const] })),
  { name: "Outros", appliesTo: ["expense" as const, "income" as const] },
].map((c, i) => ({
  ...c,
  parentId: null,
  monthlyCapCents: null,
  isBenefit: false,
  color: null,
  icon: null,
  isActive: true,
  sortOrder: i,
}));

/**
 * Seeds accounts and categories when the user has none. Safe to call on every
 * sign-in. Sequential on purpose: the first queries after a sign-in share a
 * session that was just created, and firing them concurrently has produced
 * spurious 401s.
 */
export async function seedUserIfEmpty(repos: Repositories, userId: string): Promise<{ seeded: boolean }> {
  const accounts = await repos.accounts.count(userId);
  if (accounts > 0) return { seeded: false };
  const categories = await repos.categories.count(userId);
  if (categories > 0) return { seeded: false };
  await repos.accounts.insertMany(userId, SEED_ACCOUNTS);
  await repos.categories.insertMany(userId, SEED_CATEGORIES);
  return { seeded: true };
}
