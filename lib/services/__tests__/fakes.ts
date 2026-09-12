// In-memory repositories for service tests (PROMPT.md §12): same interface,
// no database. Each fake enforces the invariants the real database would.

import type { Account, Category } from "@/lib/domain/types";
import type { AccountsRepo, CategoriesRepo, NewAccount, NewCategory, Repositories } from "@/lib/repositories";
import { RepositoryError } from "@/lib/repositories";

let seq = 0;
const nextId = () => `id-${++seq}`;

type Owned<T> = T & { userId: string };

export function fakeRepositories(): Repositories & { accountsInUse: Set<string>; categoriesInUse: Set<string> } {
  const accounts: Owned<Account>[] = [];
  const categories: Owned<Category>[] = [];
  const accountsInUse = new Set<string>();
  const categoriesInUse = new Set<string>();

  const strip = <T extends { userId: string }>(row: T): Omit<T, "userId"> => {
    const { userId, ...rest } = row;
    void userId;
    return rest;
  };

  const accountsRepo: AccountsRepo = {
    async list(userId) {
      return accounts.filter((a) => a.userId === userId).map(strip);
    },
    async getById(userId, id) {
      const row = accounts.find((a) => a.userId === userId && a.id === id);
      return row ? strip(row) : null;
    },
    async count(userId) {
      return accounts.filter((a) => a.userId === userId).length;
    },
    async insert(userId, data: NewAccount) {
      const row = { ...data, id: nextId(), userId };
      accounts.push(row);
      return strip(row);
    },
    async insertMany(userId, data) {
      return Promise.all(data.map((d) => accountsRepo.insert(userId, d)));
    },
    async update(userId, id, patch) {
      const row = accounts.find((a) => a.userId === userId && a.id === id);
      if (!row) throw new RepositoryError("not_found", "account not found");
      Object.assign(row, patch);
      return strip(row);
    },
    async delete(userId, id) {
      if (accountsInUse.has(id)) throw new RepositoryError("in_use", "referenced");
      const i = accounts.findIndex((a) => a.userId === userId && a.id === id);
      if (i >= 0) accounts.splice(i, 1);
    },
  };

  const categoriesRepo: CategoriesRepo = {
    async list(userId) {
      return categories.filter((c) => c.userId === userId).map(strip);
    },
    async getById(userId, id) {
      const row = categories.find((c) => c.userId === userId && c.id === id);
      return row ? strip(row) : null;
    },
    async count(userId) {
      return categories.filter((c) => c.userId === userId).length;
    },
    async insert(userId, data: NewCategory) {
      if (categories.some((c) => c.userId === userId && c.parentId === data.parentId && c.name === data.name)) {
        throw new RepositoryError("conflict", "duplicate");
      }
      const row = { ...data, id: nextId(), userId };
      categories.push(row);
      return strip(row);
    },
    async insertMany(userId, data) {
      return Promise.all(data.map((d) => categoriesRepo.insert(userId, d)));
    },
    async update(userId, id, patch) {
      const row = categories.find((c) => c.userId === userId && c.id === id);
      if (!row) throw new RepositoryError("not_found", "category not found");
      Object.assign(row, patch);
      return strip(row);
    },
    async delete(userId, id) {
      if (categoriesInUse.has(id) || categories.some((c) => c.parentId === id)) {
        throw new RepositoryError("in_use", "referenced");
      }
      const i = categories.findIndex((c) => c.userId === userId && c.id === id);
      if (i >= 0) categories.splice(i, 1);
    },
  };

  return { accounts: accountsRepo, categories: categoriesRepo, accountsInUse, categoriesInUse };
}
