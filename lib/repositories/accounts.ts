import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { Account } from "@/lib/domain/types";
import { fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["accounts"]["Row"];
type Insert = Database["public"]["Tables"]["accounts"]["Insert"];

export type NewAccount = Omit<Account, "id">;

export interface AccountsRepo {
  list(userId: string): Promise<Account[]>;
  getById(userId: string, id: string): Promise<Account | null>;
  count(userId: string): Promise<number>;
  insert(userId: string, data: NewAccount): Promise<Account>;
  insertMany(userId: string, data: NewAccount[]): Promise<Account[]>;
  update(userId: string, id: string, patch: Partial<NewAccount>): Promise<Account>;
  /** Throws `in_use` when entries or other rows still reference the account. */
  delete(userId: string, id: string): Promise<void>;
}

function toDomain(row: Row): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    creditLimitCents: row.credit_limit_cents,
    openingBalanceCents: row.opening_balance_cents,
    openingOn: row.opening_on,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function toRow(userId: string, data: Partial<NewAccount>): Partial<Insert> & { user_id: string } {
  const row: Partial<Insert> & { user_id: string } = { user_id: userId };
  if (data.name !== undefined) row.name = data.name;
  if (data.type !== undefined) row.type = data.type;
  if (data.institution !== undefined) row.institution = data.institution;
  if (data.closingDay !== undefined) row.closing_day = data.closingDay;
  if (data.dueDay !== undefined) row.due_day = data.dueDay;
  if (data.creditLimitCents !== undefined) row.credit_limit_cents = data.creditLimitCents;
  if (data.openingBalanceCents !== undefined) row.opening_balance_cents = data.openingBalanceCents;
  if (data.openingOn !== undefined) row.opening_on = data.openingOn;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  return row;
}

function toInsert(userId: string, data: NewAccount): Insert {
  return { ...toRow(userId, data), name: data.name, type: data.type };
}

export function supabaseAccountsRepo(db: DbClient): AccountsRepo {
  return {
    async list(userId) {
      const { data, error } = await db
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order")
        .order("name");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },

    async getById(userId, id) {
      const { data, error } = await db.from("accounts").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },

    async count(userId) {
      const { count, error, status, statusText } = await db.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (error) throw fromPostgres(error, { status, statusText });
      return count ?? 0;
    },

    async insert(userId, data) {
      const { data: row, error } = await db.from("accounts").insert(toInsert(userId, data)).select("*").single();
      if (error) throw fromPostgres(error);
      return toDomain(row);
    },

    async insertMany(userId, data) {
      if (data.length === 0) return [];
      const { data: rows, error } = await db
        .from("accounts")
        .insert(data.map((d) => toInsert(userId, d)))
        .select("*");
      if (error) throw fromPostgres(error);
      return rows.map(toDomain);
    },

    async update(userId, id, patch) {
      const { data: row, error } = await db
        .from("accounts")
        .update(toRow(userId, patch))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "account not found");
      return toDomain(row);
    },

    async delete(userId, id) {
      const { error } = await db.from("accounts").delete().eq("user_id", userId).eq("id", id);
      if (error) throw fromPostgres(error);
    },
  };
}
