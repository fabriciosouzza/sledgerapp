// The only place that talks to the database (PROMPT.md §4.2). Services take a
// `Repositories` bundle, so tests hand them fakes and a driver swap rewrites
// this folder alone.

import type { DbClient } from "@/lib/db/client";
import { supabaseAccountsRepo, type AccountsRepo } from "./accounts";
import { supabaseAssetsRepo, type AssetsRepo } from "./assets";
import { supabaseCategoriesRepo, type CategoriesRepo } from "./categories";
import { supabaseEntriesRepo, type EntriesRepo } from "./entries";
import { supabaseMovementsRepo, type MovementsRepo } from "./movements";
import { supabaseRecurrencesRepo, type RecurrencesRepo } from "./recurrences";
import { supabaseStatementsRepo, type StatementsRepo } from "./statements";

export interface Repositories {
  accounts: AccountsRepo;
  categories: CategoriesRepo;
  entries: EntriesRepo;
  recurrences: RecurrencesRepo;
  statements: StatementsRepo;
  assets: AssetsRepo;
  movements: MovementsRepo;
}

/**
 * Accounts and categories are read by nearly every service a screen composes
 * (Today asks for them five times). Repositories live for one request, so the
 * first `list` is kept until something on that repo writes.
 */
function memoList<R extends { list(userId: string): Promise<unknown[]> }>(repo: R): R {
  let cached: { userId: string; rows: Promise<unknown[]> } | null = null;
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop === "list") {
        return (userId: string) => {
          if (cached === null || cached.userId !== userId) cached = { userId, rows: value.call(target, userId) };
          return cached.rows;
        };
      }
      if (prop === "getById" || prop === "count") return value.bind(target);
      return (...args: unknown[]) => {
        cached = null;
        return value.apply(target, args);
      };
    },
  });
}

export function createRepositories(db: DbClient): Repositories {
  return {
    accounts: memoList(supabaseAccountsRepo(db)),
    categories: memoList(supabaseCategoriesRepo(db)),
    entries: supabaseEntriesRepo(db),
    recurrences: supabaseRecurrencesRepo(db),
    statements: supabaseStatementsRepo(db),
    assets: supabaseAssetsRepo(db),
    movements: supabaseMovementsRepo(db),
  };
}

export { RepositoryError, type RepositoryErrorCode } from "./errors";
export type { AccountsRepo, NewAccount } from "./accounts";
export type { CategoriesRepo, NewCategory } from "./categories";
export type { EntriesRepo, EntryFilters } from "./entries";
export type { NewRecurrence, RecurrencesRepo } from "./recurrences";
export type { NewStatement, StatementsRepo } from "./statements";
export type { AssetsRepo, NewAsset } from "./assets";
export type { MovementsRepo, NewMovement } from "./movements";
