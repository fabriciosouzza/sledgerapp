import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { Recurrence } from "@/lib/domain/types";
import { fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["recurrences"]["Row"];
type Insert = Database["public"]["Tables"]["recurrences"]["Insert"];

export type NewRecurrence = Omit<Recurrence, "id">;

export interface RecurrencesRepo {
  list(userId: string): Promise<Recurrence[]>;
  getById(userId: string, id: string): Promise<Recurrence | null>;
  insert(userId: string, data: NewRecurrence): Promise<Recurrence>;
  update(userId: string, id: string, patch: Partial<NewRecurrence>): Promise<Recurrence>;
  delete(userId: string, id: string): Promise<void>;
}

function toDomain(row: Row): Recurrence {
  return {
    id: row.id,
    description: row.description,
    kind: row.kind,
    categoryId: row.category_id,
    accountId: row.account_id,
    counterAccountId: row.counter_account_id,
    amountCents: row.amount_cents,
    dueDay: row.due_day,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVariable: row.is_variable,
    isActive: row.is_active,
  };
}

function toRow(userId: string, data: Partial<NewRecurrence>): Partial<Insert> & { user_id: string } {
  const row: Partial<Insert> & { user_id: string } = { user_id: userId };
  if (data.description !== undefined) row.description = data.description;
  if (data.kind !== undefined) row.kind = data.kind;
  if (data.categoryId !== undefined) row.category_id = data.categoryId;
  if (data.accountId !== undefined) row.account_id = data.accountId;
  if (data.counterAccountId !== undefined) row.counter_account_id = data.counterAccountId;
  if (data.amountCents !== undefined) row.amount_cents = data.amountCents;
  if (data.dueDay !== undefined) row.due_day = data.dueDay;
  if (data.startsOn !== undefined) row.starts_on = data.startsOn;
  if (data.endsOn !== undefined) row.ends_on = data.endsOn;
  if (data.isVariable !== undefined) row.is_variable = data.isVariable;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  return row;
}

function toInsert(userId: string, data: NewRecurrence): Insert {
  return {
    ...toRow(userId, data),
    description: data.description,
    kind: data.kind,
    account_id: data.accountId,
    amount_cents: data.amountCents,
    due_day: data.dueDay,
    starts_on: data.startsOn,
  };
}

export function supabaseRecurrencesRepo(db: DbClient): RecurrencesRepo {
  return {
    async list(userId) {
      const { data, error } = await db.from("recurrences").select("*").eq("user_id", userId).order("due_day").order("description");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },

    async getById(userId, id) {
      const { data, error } = await db.from("recurrences").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },

    async insert(userId, data) {
      const { data: row, error } = await db.from("recurrences").insert(toInsert(userId, data)).select("*").single();
      if (error) throw fromPostgres(error);
      return toDomain(row);
    },

    async update(userId, id, patch) {
      const { data: row, error } = await db
        .from("recurrences")
        .update(toRow(userId, patch))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "recurrence not found");
      return toDomain(row);
    },

    async delete(userId, id) {
      const { error } = await db.from("recurrences").delete().eq("user_id", userId).eq("id", id);
      if (error) throw fromPostgres(error);
    },
  };
}
