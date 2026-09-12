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

/** Seeds accounts and categories when the user has none. Safe to call on every sign-in. */
export async function seedUserIfEmpty(repos: Repositories, userId: string): Promise<{ seeded: boolean }> {
  const [accounts, categories] = await Promise.all([repos.accounts.count(userId), repos.categories.count(userId)]);
  if (accounts > 0 || categories > 0) return { seeded: false };
  await Promise.all([
    repos.accounts.insertMany(userId, SEED_ACCOUNTS),
    repos.categories.insertMany(userId, SEED_CATEGORIES),
  ]);
  return { seeded: true };
}
