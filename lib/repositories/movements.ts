import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { AssetMovement } from "@/lib/domain/types";
import { fetchAll, fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["asset_movements"]["Row"];

export type NewMovement = Omit<AssetMovement, "id">;

export interface MovementsRepo {
  /**
   * Every movement of the user, newest first. A balance is a running sum from
   * day one, so this is the one list that is not fetched by period; a
   * personal portfolio has hundreds of rows, not thousands (§4.5).
   */
  list(userId: string): Promise<AssetMovement[]>;
  listByAsset(userId: string, assetId: string): Promise<AssetMovement[]>;
  getById(userId: string, id: string): Promise<AssetMovement | null>;
  /** The movement paired with a cash entry, if any. */
  getByEntry(userId: string, entryId: string): Promise<AssetMovement | null>;
  insert(userId: string, data: NewMovement): Promise<AssetMovement>;
  update(userId: string, id: string, patch: Partial<NewMovement>): Promise<AssetMovement>;
  delete(userId: string, id: string): Promise<void>;
}

function toDomain(row: Row): AssetMovement {
  return { id: row.id, assetId: row.asset_id, date: row.date, kind: row.kind, amountCents: row.amount_cents, entryId: row.entry_id, notes: row.notes };
}

function toRow(data: Partial<NewMovement>) {
  const row: Partial<Database["public"]["Tables"]["asset_movements"]["Insert"]> = {};
  if (data.assetId !== undefined) row.asset_id = data.assetId;
  if (data.date !== undefined) row.date = data.date;
  if (data.kind !== undefined) row.kind = data.kind;
  if (data.amountCents !== undefined) row.amount_cents = data.amountCents;
  if (data.entryId !== undefined) row.entry_id = data.entryId;
  if (data.notes !== undefined) row.notes = data.notes;
  return row;
}

export function supabaseMovementsRepo(db: DbClient): MovementsRepo {
  return {
    async list(userId) {
      const rows = await fetchAll(() =>
        db.from("asset_movements").select("*").eq("user_id", userId).order("date", { ascending: false }).order("created_at", { ascending: false }).order("id"),
      );
      return rows.map(toDomain);
    },
    async listByAsset(userId, assetId) {
      const rows = await fetchAll(() =>
        db
          .from("asset_movements")
          .select("*")
          .eq("user_id", userId)
          .eq("asset_id", assetId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id"),
      );
      return rows.map(toDomain);
    },
    async getById(userId, id) {
      const { data, error } = await db.from("asset_movements").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },
    async insert(userId, data) {
      const { data: row, error } = await db
        .from("asset_movements")
        .insert({ ...toRow(data), user_id: userId, asset_id: data.assetId, date: data.date, kind: data.kind, amount_cents: data.amountCents })
        .select("*")
        .single();
      if (error) throw fromPostgres(error);
      return toDomain(row);
    },
    async update(userId, id, patch) {
      const { data: row, error } = await db.from("asset_movements").update(toRow(patch)).eq("user_id", userId).eq("id", id).select("*").maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "movement not found");
      return toDomain(row);
    },
    async getByEntry(userId, entryId) {
      const { data, error } = await db.from("asset_movements").select("*").eq("user_id", userId).eq("entry_id", entryId).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },
    async delete(userId, id) {
      const { error } = await db.from("asset_movements").delete().eq("user_id", userId).eq("id", id);
      if (error) throw fromPostgres(error);
    },
  };
}
