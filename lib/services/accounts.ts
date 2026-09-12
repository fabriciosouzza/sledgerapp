// Accounts: validate → apply rules → persist → return DTO (PROMPT.md §4.2).

import { normalizeAccountFields } from "@/lib/domain/accounts";
import type { Account } from "@/lib/domain/types";
import { RepositoryError, type Repositories } from "@/lib/repositories";
import type { AccountInput } from "@/lib/schemas/accounts";
import { ServiceError } from "./errors";

export async function listAccounts(repos: Repositories, userId: string): Promise<Account[]> {
  return repos.accounts.list(userId);
}

export async function getAccount(repos: Repositories, userId: string, id: string): Promise<Account> {
  const account = await repos.accounts.getById(userId, id);
  if (!account) throw new ServiceError("not_found", "Account not found.");
  return account;
}

export async function createAccount(repos: Repositories, userId: string, input: AccountInput): Promise<Account> {
  const existing = await repos.accounts.list(userId);
  const sortOrder = existing.reduce((max, a) => Math.max(max, a.sortOrder), -1) + 1;
  return repos.accounts.insert(userId, normalizeAccountFields({ ...input, sortOrder }));
}

export async function updateAccount(repos: Repositories, userId: string, id: string, input: AccountInput): Promise<Account> {
  const current = await getAccount(repos, userId, id);
  return repos.accounts.update(userId, id, normalizeAccountFields({ ...input, sortOrder: current.sortOrder }));
}

export async function setAccountActive(repos: Repositories, userId: string, id: string, isActive: boolean): Promise<Account> {
  return repos.accounts.update(userId, id, { isActive });
}

/** Deletes when nothing references the account; otherwise says so, and the UI offers to deactivate. */
export async function deleteAccount(repos: Repositories, userId: string, id: string): Promise<void> {
  await getAccount(repos, userId, id);
  try {
    await repos.accounts.delete(userId, id);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "in_use") {
      throw new ServiceError("in_use", "This account has entries. Deactivate it instead.");
    }
    throw error;
  }
}
