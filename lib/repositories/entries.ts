import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import { periodEnd, periodStart } from "@/lib/domain/dates";
import type { Entry, EntryKind, EntryStatus, IsoDate, NewEntry, Period } from "@/lib/domain/types";
import { fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["entries"]["Row"];
type Insert = Database["public"]["Tables"]["entries"]["Insert"];

export interface EntryFilters {
  period?: Period;
  /** Inclusive date bounds, used instead of `period` when given. */
  from?: IsoDate;
  to?: IsoDate;
  kind?: EntryKind;
  status?: EntryStatus;
  accountId?: string;
  /** Entries where the account is either side (source or counter). */
  touchingAccountIds?: string[];
  categoryId?: string;
  /** Case-insensitive substring of the description. */
  search?: string;
  statementId?: string;
  installmentGroupId?: string;
  recurrenceId?: string;
}

export interface EntriesRepo {
  /** Always bounded: by period, by date range, or by a group. Never the whole table (§4.5). */
  list(userId: string, filters: EntryFilters): Promise<Entry[]>;
  getById(userId: string, id: string): Promise<Entry | null>;
  insert(userId: string, data: NewEntry): Promise<Entry>;
  /** Idempotent generation: rows hitting the (recurrence, period) unique index are skipped; returns those inserted. */
  insertMany(userId: string, data: NewEntry[], options?: { ignoreConflicts?: boolean }): Promise<Entry[]>;
  update(userId: string, id: string, patch: Partial<NewEntry>): Promise<Entry>;
  updateMany(userId: string, ids: string[], patch: Partial<NewEntry>): Promise<Entry[]>;
  deleteMany(userId: string, ids: string[]): Promise<number>;
}

export function toDomainEntry(row: Row): Entry {
  return {
    id: row.id,
    date: row.date,
    settledOn: row.settled_on,
    kind: row.kind,
    status: row.status,
    amountCents: row.amount_cents,
    description: row.description,
    categoryId: row.category_id,
    accountId: row.account_id,
    counterAccountId: row.counter_account_id,
    notes: row.notes,
    source: row.source,
    recurrenceId: row.recurrence_id,
    period: row.period,
    installmentGroupId: row.installment_group_id,
    installmentNo: row.installment_no,
    installmentTotal: row.installment_total,
    statementId: row.statement_id,
  };
}

function toRow(userId: string, data: Partial<NewEntry>): Partial<Insert> & { user_id: string } {
  const row: Partial<Insert> & { user_id: string } = { user_id: userId };
  if (data.date !== undefined) row.date = data.date;
  if (data.settledOn !== undefined) row.settled_on = data.settledOn;
  if (data.kind !== undefined) row.kind = data.kind;
  if (data.status !== undefined) row.status = data.status;
  if (data.amountCents !== undefined) row.amount_cents = data.amountCents;
  if (data.description !== undefined) row.description = data.description;
  if (data.categoryId !== undefined) row.category_id = data.categoryId;
  if (data.accountId !== undefined) row.account_id = data.accountId;
  if (data.counterAccountId !== undefined) row.counter_account_id = data.counterAccountId;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.source !== undefined) row.source = data.source;
  if (data.recurrenceId !== undefined) row.recurrence_id = data.recurrenceId;
  if (data.period !== undefined) row.period = data.period;
  if (data.installmentGroupId !== undefined) row.installment_group_id = data.installmentGroupId;
  if (data.installmentNo !== undefined) row.installment_no = data.installmentNo;
  if (data.installmentTotal !== undefined) row.installment_total = data.installmentTotal;
  if (data.statementId !== undefined) row.statement_id = data.statementId;
  return row;
}

function toInsert(userId: string, data: NewEntry): Insert {
  return {
    ...toRow(userId, data),
    date: data.date,
    kind: data.kind,
    amount_cents: data.amountCents,
    description: data.description,
    account_id: data.accountId,
  };
}

export function supabaseEntriesRepo(db: DbClient): EntriesRepo {
  return {
    async list(userId, filters) {
      let q = db.from("entries").select("*").eq("user_id", userId);
      const from = filters.from ?? (filters.period ? periodStart(filters.period) : undefined);
      const to = filters.to ?? (filters.period ? periodEnd(filters.period) : undefined);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      if (filters.kind) q = q.eq("kind", filters.kind);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.accountId) q = q.eq("account_id", filters.accountId);
      if (filters.touchingAccountIds && filters.touchingAccountIds.length > 0) {
        const ids = filters.touchingAccountIds.join(",");
        q = q.or(`account_id.in.(${ids}),counter_account_id.in.(${ids})`);
      }
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.statementId) q = q.eq("statement_id", filters.statementId);
      if (filters.installmentGroupId) q = q.eq("installment_group_id", filters.installmentGroupId);
      if (filters.recurrenceId) q = q.eq("recurrence_id", filters.recurrenceId);
      if (filters.search) q = q.ilike("description", `%${filters.search.replace(/[%_]/g, "\\$&")}%`);
      if (!from && !to && !filters.statementId && !filters.installmentGroupId && !filters.recurrenceId) {
        throw new RepositoryError("invalid", "entries.list needs a period, a date range or a group");
      }
      const { data, error } = await q.order("date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw fromPostgres(error);
      return data.map(toDomainEntry);
    },

    async getById(userId, id) {
      const { data, error } = await db.from("entries").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomainEntry(data) : null;
    },

    async insert(userId, data) {
      const { data: row, error } = await db.from("entries").insert(toInsert(userId, data)).select("*").single();
      if (error) throw fromPostgres(error);
      return toDomainEntry(row);
    },

    async insertMany(userId, data, options) {
      if (data.length === 0) return [];
      const rows = data.map((d) => toInsert(userId, d));
      const query = options?.ignoreConflicts
        ? db.from("entries").upsert(rows, { onConflict: "recurrence_id,period", ignoreDuplicates: true })
        : db.from("entries").insert(rows);
      const { data: inserted, error } = await query.select("*");
      if (error) throw fromPostgres(error);
      return inserted.map(toDomainEntry);
    },

    async update(userId, id, patch) {
      const { data: row, error } = await db
        .from("entries")
        .update(toRow(userId, patch))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "entry not found");
      return toDomainEntry(row);
    },

    async updateMany(userId, ids, patch) {
      if (ids.length === 0) return [];
      const { data: rows, error } = await db
        .from("entries")
        .update(toRow(userId, patch))
        .eq("user_id", userId)
        .in("id", ids)
        .select("*");
      if (error) throw fromPostgres(error);
      return rows.map(toDomainEntry);
    },

    async deleteMany(userId, ids) {
      if (ids.length === 0) return 0;
      const { data, error } = await db.from("entries").delete().eq("user_id", userId).in("id", ids).select("id");
      if (error) throw fromPostgres(error);
      return data.length;
    },
  };
}
