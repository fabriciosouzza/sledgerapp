import type { Account, Category } from "@/lib/domain/types";

/** Names by id, for lists that show an entry's category and account. */
export interface Lookups {
  accounts: Record<string, Pick<Account, "id" | "name" | "type" | "closingDay" | "dueDay">>;
  categories: Record<string, Pick<Category, "id" | "name" | "parentId" | "icon" | "color">>;
}

export function buildLookups(accounts: Account[], categories: Category[]): Lookups {
  return {
    accounts: Object.fromEntries(accounts.map((a) => [a.id, { id: a.id, name: a.name, type: a.type, closingDay: a.closingDay, dueDay: a.dueDay }])),
    categories: Object.fromEntries(categories.map((c) => [c.id, { id: c.id, name: c.name, parentId: c.parentId, icon: c.icon, color: c.color }])),
  };
}
