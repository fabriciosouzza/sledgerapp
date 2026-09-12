// The only place that talks to the database (PROMPT.md §4.2). Services take a
// `Repositories` bundle, so tests hand them fakes and a driver swap rewrites
// this folder alone.

import type { DbClient } from "@/lib/db/client";
import { supabaseAccountsRepo, type AccountsRepo } from "./accounts";
import { supabaseCategoriesRepo, type CategoriesRepo } from "./categories";
import { supabaseEntriesRepo, type EntriesRepo } from "./entries";
import { supabaseRecurrencesRepo, type RecurrencesRepo } from "./recurrences";

export interface Repositories {
  accounts: AccountsRepo;
  categories: CategoriesRepo;
  entries: EntriesRepo;
  recurrences: RecurrencesRepo;
}

export function createRepositories(db: DbClient): Repositories {
  return {
    accounts: supabaseAccountsRepo(db),
    categories: supabaseCategoriesRepo(db),
    entries: supabaseEntriesRepo(db),
    recurrences: supabaseRecurrencesRepo(db),
  };
}

export { RepositoryError, type RepositoryErrorCode } from "./errors";
export type { AccountsRepo, NewAccount } from "./accounts";
export type { CategoriesRepo, NewCategory } from "./categories";
export type { EntriesRepo, EntryFilters } from "./entries";
export type { NewRecurrence, RecurrencesRepo } from "./recurrences";
