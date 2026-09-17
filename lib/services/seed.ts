// Starting set for a new user (PROMPT.md §10): editable, no entries, no cards.
// Names are user data, hence Portuguese. Runs from the app after sign-up —
// never from a database trigger (§4.1) — and only for an empty user.

import { today } from "@/lib/domain/dates";
import type { AccountType } from "@/lib/domain/types";
import type { NewAccount, NewCategory, Repositories } from "@/lib/repositories";

const ACCOUNTS: { name: string; type: AccountType }[] = [
  { name: "Conta Corrente", type: "checking" },
  { name: "Dinheiro", type: "cash" },
  // No brokerage account: investments are assets, held at the asset's `broker` (§5.7).
  { name: "Reserva", type: "savings" },
];

export const SEED_ACCOUNTS: NewAccount[] = ACCOUNTS.map((a, i) => ({
  ...a,
  institution: null,
  closingDay: null,
  dueDay: null,
  creditLimitCents: null,
  targetCents: null,
  // Starts empty today; the user sets the real opening balance in settings.
  openingBalanceCents: 0,
  openingOn: today(),
  isActive: true,
  sortOrder: i,
}));

const EXPENSE_CATEGORIES = [
  { name: "Moradia", icon: "home" },
  { name: "Alimentação", icon: "utensils" },
  { name: "Transporte", icon: "car" },
  { name: "Saúde", icon: "heart-pulse" },
  { name: "Educação", icon: "graduation-cap" },
  { name: "Assinaturas", icon: "tv" },
  { name: "Lazer", icon: "plane" },
  { name: "Dívidas e parcelas", icon: "credit-card" },
];

const INCOME_CATEGORIES = [
  { name: "Salário", icon: "briefcase" },
  // Freelance, a bonus, something sold.
  { name: "Extras", icon: "hand-coins" },
  { name: "Reembolso", icon: "receipt" },
  { name: "Cashback", icon: "coins" },
];

export const SEED_CATEGORIES: NewCategory[] = [
  ...EXPENSE_CATEGORIES.map(({ name, icon }) => ({ name, icon, appliesTo: ["expense" as const], isEarmarked: false })),
  ...INCOME_CATEGORIES.map(({ name, icon }) => ({ name, icon, appliesTo: ["income" as const], isEarmarked: false })),
  // In and out under one name: the voucher arrives as income and leaves as lunches, and both stay out of the second savings rate (§5.8).
  { name: "Vale-refeição", icon: "ticket", appliesTo: ["income" as const, "expense" as const], isEarmarked: true },
  { name: "Outros", icon: "wallet", appliesTo: ["expense" as const, "income" as const], isEarmarked: false },
].map((c, i) => ({
  ...c,
  parentId: null,
  monthlyCapCents: null,
  // Icons only: colour stays for meaning, not decoration (DESIGN.md, 2026-09-14).
  color: null,
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

/** Starter categories the user does not have, by top-level name — the set grows, and an older account may want the new ones. */
export async function missingSeedCategories(repos: Repositories, userId: string): Promise<NewCategory[]> {
  const have = new Set((await repos.categories.list(userId)).filter((c) => c.parentId === null).map((c) => c.name));
  return SEED_CATEGORIES.filter((c) => !have.has(c.name));
}

/** Adds the starter categories still missing, after the user's own, without touching what exists. */
export async function seedMissingCategories(repos: Repositories, userId: string): Promise<{ added: number }> {
  const missing = await missingSeedCategories(repos, userId);
  if (missing.length === 0) return { added: 0 };
  const existing = await repos.categories.list(userId);
  const next = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  const rows = await repos.categories.insertMany(userId, missing.map((c, i) => ({ ...c, sortOrder: next + i })));
  return { added: rows.length };
}
