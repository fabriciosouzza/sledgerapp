import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { IsoDate, Statement } from "@/lib/domain/types";
import { fetchAll, fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["statements"]["Row"];

export type NewStatement = Omit<Statement, "id">;

export interface StatementsRepo {
  listByUser(userId: string): Promise<Statement[]>;
  listByAccount(userId: string, accountId: string): Promise<Statement[]>;
  getById(userId: string, id: string): Promise<Statement | null>;
  /** Create-if-missing on (account_id, cycle_start); returns the row either way. */
  ensure(userId: string, data: NewStatement): Promise<Statement>;
  setPaidOn(userId: string, id: string, paidOn: IsoDate | null): Promise<Statement>;
}

function toDomain(row: Row): Statement {
  return {
    id: row.id,
    accountId: row.account_id,
    cycleStart: row.cycle_start,
    cycleEnd: row.cycle_end,
    dueDate: row.due_date,
    paidOn: row.paid_on,
  };
}

export function supabaseStatementsRepo(db: DbClient): StatementsRepo {
  return {
    async listByUser(userId) {
      const rows = await fetchAll(() => db.from("statements").select("*").eq("user_id", userId).order("cycle_start", { ascending: false }).order("id"));
      return rows.map(toDomain);
    },

    async listByAccount(userId, accountId) {
      const rows = await fetchAll(() =>
        db.from("statements").select("*").eq("user_id", userId).eq("account_id", accountId).order("cycle_start", { ascending: false }).order("id"),
      );
      return rows.map(toDomain);
    },

    async getById(userId, id) {
      const { data, error } = await db.from("statements").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },

    async ensure(userId, data) {
      const { data: inserted, error } = await db
        .from("statements")
        .upsert(
          {
            user_id: userId,
            account_id: data.accountId,
            cycle_start: data.cycleStart,
            cycle_end: data.cycleEnd,
            due_date: data.dueDate,
            paid_on: data.paidOn,
          },
          { onConflict: "account_id,cycle_start", ignoreDuplicates: true },
        )
        .select("*")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (inserted) return toDomain(inserted);
      const { data: existing, error: readError } = await db
        .from("statements")
        .select("*")
        .eq("user_id", userId)
        .eq("account_id", data.accountId)
        .eq("cycle_start", data.cycleStart)
        .single();
      if (readError) throw fromPostgres(readError);
      return toDomain(existing);
    },

    async setPaidOn(userId, id, paidOn) {
      const { data, error } = await db
        .from("statements")
        .update({ paid_on: paidOn })
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (!data) throw new RepositoryError("not_found", "statement not found");
      return toDomain(data);
    },
  };
}
