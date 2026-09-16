import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { Recurrence, RecurrenceShare } from "@/lib/domain/types";
import { fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["recurrences"]["Row"];
type Insert = Database["public"]["Tables"]["recurrences"]["Insert"];
type ShareRow = Pick<Database["public"]["Tables"]["recurrence_allocations"]["Row"], "asset_id" | "share_percent">;
/** A recurrence with its default split embedded, the way PostgREST returns the child rows. */
type RowWithShares = Row & { recurrence_allocations: ShareRow[] };

export type NewRecurrence = Omit<Recurrence, "id">;

const SELECT = "*, recurrence_allocations(asset_id, share_percent)";

export interface RecurrencesRepo {
  list(userId: string): Promise<Recurrence[]>;
  getById(userId: string, id: string): Promise<Recurrence | null>;
  insert(userId: string, data: NewRecurrence): Promise<Recurrence>;
  update(userId: string, id: string, patch: Partial<NewRecurrence>): Promise<Recurrence>;
  delete(userId: string, id: string): Promise<void>;
}

function toDomain(row: RowWithShares): Recurrence {
  return {
    allocations: row.recurrence_allocations.map((s): RecurrenceShare => ({ assetId: s.asset_id, sharePercent: s.share_percent })),
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
  /** The default split is replaced whole: delete, then insert what was given. */
  async function writeShares(userId: string, recurrenceId: string, shares: RecurrenceShare[]): Promise<void> {
    const { error: cleared } = await db.from("recurrence_allocations").delete().eq("user_id", userId).eq("recurrence_id", recurrenceId);
    if (cleared) throw fromPostgres(cleared);
    if (shares.length === 0) return;
    const { error } = await db
      .from("recurrence_allocations")
      .insert(shares.map((s) => ({ user_id: userId, recurrence_id: recurrenceId, asset_id: s.assetId, share_percent: s.sharePercent })));
    if (error) throw fromPostgres(error);
  }

  async function read(userId: string, id: string): Promise<Recurrence> {
    const { data, error } = await db.from("recurrences").select(SELECT).eq("user_id", userId).eq("id", id).maybeSingle();
    if (error) throw fromPostgres(error);
    if (!data) throw new RepositoryError("not_found", "recurrence not found");
    return toDomain(data);
  }

  return {
    async list(userId) {
      const { data, error } = await db.from("recurrences").select(SELECT).eq("user_id", userId).order("due_day").order("description");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },

    async getById(userId, id) {
      const { data, error } = await db.from("recurrences").select(SELECT).eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },

    async insert(userId, data) {
      const { data: row, error } = await db.from("recurrences").insert(toInsert(userId, data)).select("id").single();
      if (error) throw fromPostgres(error);
      await writeShares(userId, row.id, data.allocations);
      return read(userId, row.id);
    },

    async update(userId, id, patch) {
      const { data: row, error } = await db
        .from("recurrences")
        .update(toRow(userId, patch))
        .eq("user_id", userId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "recurrence not found");
      if (patch.allocations !== undefined) await writeShares(userId, id, patch.allocations);
      return read(userId, id);
    },

    async delete(userId, id) {
      const { error } = await db.from("recurrences").delete().eq("user_id", userId).eq("id", id);
      if (error) throw fromPostgres(error);
    },
  };
}
