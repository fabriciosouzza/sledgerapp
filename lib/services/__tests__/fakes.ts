// In-memory repositories for service tests (PROMPT.md §12): same interface,
// no database. Each fake enforces the invariants the real database would.

import { periodEnd, periodStart } from "@/lib/domain/dates";
import type { Account, Asset, AssetMovement, Category, Entry, NewEntry, Recurrence, Statement } from "@/lib/domain/types";
import type {
  AccountsRepo,
  AssetsRepo,
  CategoriesRepo,
  EntriesRepo,
  MovementsRepo,
  NewAccount,
  NewAsset,
  NewCategory,
  NewMovement,
  NewRecurrence,
  RecurrencesRepo,
  Repositories,
  StatementsRepo,
} from "@/lib/repositories";
import { RepositoryError } from "@/lib/repositories";

const nextId = () => crypto.randomUUID();

type Owned<T> = T & { userId: string };

export interface FakeRepositories extends Repositories {
  accountsInUse: Set<string>;
  categoriesInUse: Set<string>;
  /** Raw rows, for assertions. */
  rows: { entries: Owned<Entry>[]; recurrences: Owned<Recurrence>[]; statements: Owned<Statement>[] };
}

export function fakeRepositories(): FakeRepositories {
  const accounts: Owned<Account>[] = [];
  const categories: Owned<Category>[] = [];
  const entries: Owned<Entry>[] = [];
  const recurrences: Owned<Recurrence>[] = [];
  const statements: Owned<Statement>[] = [];
  const assets: Owned<Asset>[] = [];
  const movements: Owned<AssetMovement>[] = [];
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

  const checkEntry = (e: NewEntry) => {
    if (e.amountCents <= 0) throw new RepositoryError("invalid", "amount");
    if ((e.status === "settled") !== (e.settledOn !== null)) throw new RepositoryError("invalid", "settled");
    if ((e.kind === "transfer") !== (e.counterAccountId !== null)) {
      throw new RepositoryError("invalid", "counter");
    }
    if ((e.kind === "income" || e.kind === "expense") && e.categoryId === null) throw new RepositoryError("invalid", "category");
  };

  const entriesRepo: EntriesRepo = {
    async list(userId, f) {
      const from = f.from ?? (f.period ? periodStart(f.period) : null);
      const to = f.to ?? (f.period ? periodEnd(f.period) : null);
      return entries
        .filter((e) => e.userId === userId)
        .filter((e) => (from ? e.date >= from : true) && (to ? e.date <= to : true))
        .filter((e) => (f.settledFrom ? e.settledOn !== null && e.settledOn >= f.settledFrom : true))
        .filter((e) => (f.settledTo ? e.settledOn !== null && e.settledOn <= f.settledTo : true))
        .filter((e) => (f.kind ? e.kind === f.kind : true))
        .filter((e) => (f.kinds ? f.kinds.includes(e.kind) : true))
        .filter((e) => (f.status ? e.status === f.status : true))
        .filter((e) => (f.accountId ? e.accountId === f.accountId : true))
        .filter((e) => (f.touchingAccountIds ? f.touchingAccountIds.includes(e.accountId) || (e.counterAccountId !== null && f.touchingAccountIds.includes(e.counterAccountId)) : true))
        .filter((e) => (f.categoryId ? e.categoryId === f.categoryId : true))
        .filter((e) => (f.categoryIds && f.categoryIds.length > 0 ? e.categoryId !== null && f.categoryIds.includes(e.categoryId) : true))
        .filter((e) => (f.installmentGroupId ? e.installmentGroupId === f.installmentGroupId : true))
        .filter((e) => (f.recurrenceId ? e.recurrenceId === f.recurrenceId : true))
        .filter((e) => (f.statementId ? e.statementId === f.statementId : true))
        .filter((e) => (f.search ? `${e.description} ${e.notes ?? ""}`.toLowerCase().includes(f.search.toLowerCase()) : true))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map(strip);
    },
    async getById(userId, id) {
      const row = entries.find((e) => e.userId === userId && e.id === id);
      return row ? strip(row) : null;
    },
    async existsForAccount(userId, accountId) {
      return entries.some((e) => e.userId === userId && (e.accountId === accountId || e.counterAccountId === accountId));
    },
    async insert(userId, data) {
      checkEntry(data);
      const row = { ...data, id: nextId(), userId };
      entries.push(row);
      return strip(row);
    },
    async insertMany(userId, data, options) {
      const out: Entry[] = [];
      for (const d of data) {
        const dup =
          d.recurrenceId !== null && entries.some((e) => e.recurrenceId === d.recurrenceId && e.period === d.period);
        if (dup) {
          if (options?.ignoreConflicts) continue;
          throw new RepositoryError("conflict", "recurrence period");
        }
        out.push(await entriesRepo.insert(userId, d));
      }
      return out;
    },
    async update(userId, id, patch) {
      const row = entries.find((e) => e.userId === userId && e.id === id);
      if (!row) throw new RepositoryError("not_found", "entry not found");
      const next = { ...row, ...patch };
      checkEntry(next);
      Object.assign(row, patch);
      return strip(row);
    },
    async updateMany(userId, ids, patch) {
      const out: Entry[] = [];
      for (const id of ids) out.push(await entriesRepo.update(userId, id, patch));
      return out;
    },
    async deleteMany(userId, ids) {
      let n = 0;
      for (const id of ids) {
        const i = entries.findIndex((e) => e.userId === userId && e.id === id);
        if (i >= 0) {
          entries.splice(i, 1);
          n++;
        }
      }
      return n;
    },
  };

  const recurrencesRepo: RecurrencesRepo = {
    async list(userId) {
      return recurrences.filter((r) => r.userId === userId).map(strip);
    },
    async getById(userId, id) {
      const row = recurrences.find((r) => r.userId === userId && r.id === id);
      return row ? strip(row) : null;
    },
    async insert(userId, data: NewRecurrence) {
      const row = { ...data, allocations: [...data.allocations], id: nextId(), userId };
      recurrences.push(row);
      return strip(row);
    },
    async update(userId, id, patch) {
      const row = recurrences.find((r) => r.userId === userId && r.id === id);
      if (!row) throw new RepositoryError("not_found", "recurrence not found");
      Object.assign(row, patch);
      return strip(row);
    },
    async delete(userId, id) {
      const i = recurrences.findIndex((r) => r.userId === userId && r.id === id);
      if (i >= 0) recurrences.splice(i, 1);
      for (const e of entries) if (e.recurrenceId === id) e.recurrenceId = null;
    },
  };

  const statementsRepo: StatementsRepo = {
    async listByUser(userId) {
      return statements.filter((s) => s.userId === userId).map(strip);
    },
    async listByAccount(userId, accountId) {
      return statements.filter((s) => s.userId === userId && s.accountId === accountId).map(strip);
    },
    async getById(userId, id) {
      const row = statements.find((s) => s.userId === userId && s.id === id);
      return row ? strip(row) : null;
    },
    async ensure(userId, data) {
      const existing = statements.find((s) => s.accountId === data.accountId && s.cycleStart === data.cycleStart);
      if (existing) return strip(existing);
      const row = { ...data, id: nextId(), userId };
      statements.push(row);
      return strip(row);
    },
    async setPaidOn(userId, id, paidOn) {
      const row = statements.find((s) => s.userId === userId && s.id === id);
      if (!row) throw new RepositoryError("not_found", "statement not found");
      row.paidOn = paidOn;
      return strip(row);
    },
  };

  const assetsRepo: AssetsRepo = {
    async list(userId) {
      return assets.filter((a) => a.userId === userId).map(strip);
    },
    async getById(userId, id) {
      const row = assets.find((a) => a.userId === userId && a.id === id);
      return row ? strip(row) : null;
    },
    async insert(userId, data: NewAsset) {
      const row = { ...data, id: nextId(), userId };
      assets.push(row);
      return strip(row);
    },
    async update(userId, id, patch) {
      const row = assets.find((a) => a.userId === userId && a.id === id);
      if (!row) throw new RepositoryError("not_found", "asset not found");
      Object.assign(row, patch);
      return strip(row);
    },
    async delete(userId, id) {
      if (movements.some((m) => m.assetId === id)) throw new RepositoryError("in_use", "referenced");
      const i = assets.findIndex((a) => a.userId === userId && a.id === id);
      if (i >= 0) assets.splice(i, 1);
    },
  };

  const movementsRepo: MovementsRepo = {
    async list(userId) {
      return movements.filter((m) => m.userId === userId).map(strip);
    },
    async listByAsset(userId, assetId) {
      return movements.filter((m) => m.userId === userId && m.assetId === assetId).map(strip);
    },
    async getById(userId, id) {
      const row = movements.find((m) => m.userId === userId && m.id === id);
      return row ? strip(row) : null;
    },
    async listByEntry(userId, entryId) {
      return movements.filter((m) => m.userId === userId && m.entryId === entryId).map(strip);
    },
    async insert(userId, data: NewMovement) {
      if (data.kind !== "market_adjustment" && data.amountCents <= 0) throw new RepositoryError("invalid", "amount");
      const row = { ...data, id: nextId(), userId };
      movements.push(row);
      return strip(row);
    },
    async insertMany(userId, data) {
      const out: AssetMovement[] = [];
      for (const d of data) out.push(await movementsRepo.insert(userId, d));
      return out;
    },
    async deleteByEntry(userId, entryId) {
      let n = 0;
      for (let i = movements.length - 1; i >= 0; i--) {
        if (movements[i].userId === userId && movements[i].entryId === entryId) {
          movements.splice(i, 1);
          n++;
        }
      }
      return n;
    },
    async update(userId, id, patch) {
      const row = movements.find((m) => m.userId === userId && m.id === id);
      if (!row) throw new RepositoryError("not_found", "movement not found");
      Object.assign(row, patch);
      return strip(row);
    },
    async delete(userId, id) {
      const i = movements.findIndex((m) => m.userId === userId && m.id === id);
      if (i >= 0) movements.splice(i, 1);
    },
  };

  return {
    accounts: accountsRepo,
    categories: categoriesRepo,
    entries: entriesRepo,
    recurrences: recurrencesRepo,
    statements: statementsRepo,
    assets: assetsRepo,
    movements: movementsRepo,
    accountsInUse,
    categoriesInUse,
    rows: { entries, recurrences, statements },
  };
}
