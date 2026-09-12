import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import { periodStart } from "@/lib/domain/dates";
import type { BalanceSnapshot, Period } from "@/lib/domain/types";
import { fromPostgres } from "./errors";

type Row = Database["public"]["Tables"]["balance_snapshots"]["Row"];

export type NewSnapshot = Omit<BalanceSnapshot, "id">;

export interface SnapshotsRepo {
  /** Snapshots whose period falls in [from, to], inclusive. */
  listBetween(userId: string, from: Period, to: Period): Promise<BalanceSnapshot[]>;
  listByPeriod(userId: string, period: Period): Promise<BalanceSnapshot[]>;
  /** Insert or replace on (user, period, account). */
  upsertMany(userId: string, rows: NewSnapshot[]): Promise<BalanceSnapshot[]>;
  deleteByPeriod(userId: string, period: Period): Promise<number>;
}

function toDomain(row: Row): BalanceSnapshot {
  return { id: row.id, period: row.period, accountId: row.account_id, kind: row.kind, amountCents: row.amount_cents };
}

export function supabaseSnapshotsRepo(db: DbClient): SnapshotsRepo {
  return {
    async listBetween(userId, from, to) {
      const { data, error } = await db
        .from("balance_snapshots")
        .select("*")
        .eq("user_id", userId)
        .gte("period", periodStart(from))
        .lte("period", periodStart(to))
        .order("period");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },
    async listByPeriod(userId, period) {
      const { data, error } = await db.from("balance_snapshots").select("*").eq("user_id", userId).eq("period", periodStart(period));
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },
    async upsertMany(userId, rows) {
      if (rows.length === 0) return [];
      const { data, error } = await db
        .from("balance_snapshots")
        .upsert(
          rows.map((r) => ({ user_id: userId, period: r.period, account_id: r.accountId, kind: r.kind, amount_cents: r.amountCents })),
          { onConflict: "user_id,period,account_id" },
        )
        .select("*");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },
    async deleteByPeriod(userId, period) {
      const { data, error } = await db.from("balance_snapshots").delete().eq("user_id", userId).eq("period", periodStart(period)).select("id");
      if (error) throw fromPostgres(error);
      return data.length;
    },
  };
}
