import type { DbClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import type { Category } from "@/lib/domain/types";
import { fromPostgres, RepositoryError } from "./errors";

type Row = Database["public"]["Tables"]["categories"]["Row"];
type Insert = Database["public"]["Tables"]["categories"]["Insert"];

export type NewCategory = Omit<Category, "id">;

export interface CategoriesRepo {
  list(userId: string): Promise<Category[]>;
  getById(userId: string, id: string): Promise<Category | null>;
  count(userId: string): Promise<number>;
  insert(userId: string, data: NewCategory): Promise<Category>;
  insertMany(userId: string, data: NewCategory[]): Promise<Category[]>;
  update(userId: string, id: string, patch: Partial<NewCategory>): Promise<Category>;
  /** Throws `in_use` when entries, recurrences or children still reference it. */
  delete(userId: string, id: string): Promise<void>;
}

function toDomain(row: Row): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    appliesTo: row.applies_to,
    monthlyCapCents: row.monthly_cap_cents,
    isBenefit: row.is_benefit,
    color: row.color,
    icon: row.icon,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function toRow(userId: string, data: Partial<NewCategory>): Partial<Insert> & { user_id: string } {
  const row: Partial<Insert> & { user_id: string } = { user_id: userId };
  if (data.name !== undefined) row.name = data.name;
  if (data.parentId !== undefined) row.parent_id = data.parentId;
  if (data.appliesTo !== undefined) row.applies_to = data.appliesTo;
  if (data.monthlyCapCents !== undefined) row.monthly_cap_cents = data.monthlyCapCents;
  if (data.isBenefit !== undefined) row.is_benefit = data.isBenefit;
  if (data.color !== undefined) row.color = data.color;
  if (data.icon !== undefined) row.icon = data.icon;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  return row;
}

function toInsert(userId: string, data: NewCategory): Insert {
  return { ...toRow(userId, data), name: data.name };
}

export function supabaseCategoriesRepo(db: DbClient): CategoriesRepo {
  return {
    async list(userId) {
      const { data, error } = await db
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order")
        .order("name");
      if (error) throw fromPostgres(error);
      return data.map(toDomain);
    },

    async getById(userId, id) {
      const { data, error } = await db.from("categories").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw fromPostgres(error);
      return data ? toDomain(data) : null;
    },

    async count(userId) {
      const { count, error } = await db.from("categories").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (error) throw fromPostgres(error);
      return count ?? 0;
    },

    async insert(userId, data) {
      const { data: row, error } = await db.from("categories").insert(toInsert(userId, data)).select("*").single();
      if (error) throw fromPostgres(error);
      return toDomain(row);
    },

    async insertMany(userId, data) {
      if (data.length === 0) return [];
      const { data: rows, error } = await db
        .from("categories")
        .insert(data.map((d) => toInsert(userId, d)))
        .select("*");
      if (error) throw fromPostgres(error);
      return rows.map(toDomain);
    },

    async update(userId, id, patch) {
      const { data: row, error } = await db
        .from("categories")
        .update(toRow(userId, patch))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw fromPostgres(error);
      if (!row) throw new RepositoryError("not_found", "category not found");
      return toDomain(row);
    },

    async delete(userId, id) {
      const { error } = await db.from("categories").delete().eq("user_id", userId).eq("id", id);
      if (error) throw fromPostgres(error);
    },
  };
}
