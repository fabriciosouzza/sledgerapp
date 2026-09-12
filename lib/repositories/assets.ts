import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { Asset } from "@/lib/domain/types";
import { fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["assets"]["Row"];

export type NewAsset = Omit<Asset, "id">;

export interface AssetsRepo {
  list(userId: string): Promise<Asset[]>;
  getById(userId: string, id: string): Promise<Asset | null>;
  insert(userId: string, data: NewAsset): Promise<Asset>;
  update(userId: string, id: string, patch: Partial<NewAsset>): Promise<Asset>;
  /** Throws `in_use` while movements reference the asset. */
  delete(userId: string, id: string): Promise<void>;
}

function toDomain(row: Row): Asset {
  return { id: row.id, name: row.name, assetClass: row.asset_class, subclass: row.subclass, broker: row.broker, isActive: row.is_active };
}

function toRow(data: Partial<NewAsset>) {
  const row: Partial<Database["public"]["Tables"]["assets"]["Insert"]> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.assetClass !== undefined) row.asset_class = data.assetClass;
  if (data.subclass !== undefined) row.subclass = data.subclass;
  if (data.broker !== undefined) row.broker = data.broker;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  return row;
}

export function supabaseAssetsRepo(db: DbClient): AssetsRepo {
  return {
    async list(userId) {
      const { data, error } = await db.from("assets").select("*").eq("user_id", userId).order("name");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },
    async getById(userId, id) {
      const { data, error } = await db.from("assets").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },
    async insert(userId, data) {
      const { data: row, error } = await db
        .from("assets")
        .insert({ ...toRow(data), user_id: userId, name: data.name, asset_class: data.assetClass })
        .select("*")
        .single();
      if (error) throw fromPostgres(error);
      return toDomain(row);
    },
    async update(userId, id, patch) {
      const { data: row, error } = await db.from("assets").update(toRow(patch)).eq("user_id", userId).eq("id", id).select("*").maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "asset not found");
      return toDomain(row);
    },
    async delete(userId, id) {
      const { error } = await db.from("assets").delete().eq("user_id", userId).eq("id", id);
      if (error) throw fromPostgres(error);
    },
  };
}
