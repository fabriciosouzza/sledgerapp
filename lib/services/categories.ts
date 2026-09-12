// Categories: one level deep, unique name per parent (PROMPT.md §6).

import { canBeParent, sortCategoryTree } from "@/lib/domain/categories";
import type { Category } from "@/lib/domain/types";
import { RepositoryError, type Repositories } from "@/lib/repositories";
import type { CategoryInput } from "@/lib/schemas/categories";
import { ServiceError } from "./errors";

export async function listCategories(repos: Repositories, userId: string): Promise<Category[]> {
  return sortCategoryTree(await repos.categories.list(userId));
}

export async function getCategory(repos: Repositories, userId: string, id: string): Promise<Category> {
  const category = await repos.categories.getById(userId, id);
  if (!category) throw new ServiceError("not_found", "Category not found.");
  return category;
}

async function checkParent(repos: Repositories, userId: string, parentId: string | null, childId: string | null): Promise<void> {
  if (parentId === null) return;
  const parent = await repos.categories.getById(userId, parentId);
  if (!parent) throw new ServiceError("invalid", "Parent category not found.");
  if (!canBeParent(parent, childId)) throw new ServiceError("invalid", "Categories nest only one level deep.");
}

function fields(input: CategoryInput, sortOrder: number): Omit<Category, "id"> {
  return {
    name: input.name,
    parentId: input.parentId,
    appliesTo: input.appliesTo.length === 0 ? null : input.appliesTo,
    monthlyCapCents: input.monthlyCapCents,
    isBenefit: input.isBenefit,
    color: input.color,
    icon: input.icon,
    isActive: input.isActive,
    sortOrder,
  };
}

function translate(error: unknown): never {
  if (error instanceof RepositoryError && error.code === "conflict") {
    throw new ServiceError("conflict", "A category with this name already exists here.");
  }
  throw error;
}

export async function createCategory(repos: Repositories, userId: string, input: CategoryInput): Promise<Category> {
  await checkParent(repos, userId, input.parentId, null);
  const existing = await repos.categories.list(userId);
  const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  return repos.categories.insert(userId, fields(input, sortOrder)).catch(translate);
}

export async function updateCategory(repos: Repositories, userId: string, id: string, input: CategoryInput): Promise<Category> {
  const current = await getCategory(repos, userId, id);
  await checkParent(repos, userId, input.parentId, id);
  if (input.parentId !== null) {
    const all = await repos.categories.list(userId);
    if (all.some((c) => c.parentId === id)) {
      throw new ServiceError("invalid", "This category has sub-categories, so it cannot become one.");
    }
  }
  return repos.categories.update(userId, id, fields(input, current.sortOrder)).catch(translate);
}

/** Swaps the category with its neighbour among its siblings (same parent); -1 up, 1 down. */
export async function moveCategory(repos: Repositories, userId: string, id: string, direction: -1 | 1): Promise<void> {
  const all = sortCategoryTree(await repos.categories.list(userId));
  const me = all.find((c) => c.id === id);
  if (!me) throw new ServiceError("not_found", "Category not found.");
  const siblings = all.filter((c) => c.parentId === me.parentId);
  const index = siblings.findIndex((c) => c.id === id);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return;
  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  for (const [i, category] of reordered.entries()) {
    if (category.sortOrder !== i) await repos.categories.update(userId, category.id, { sortOrder: i });
  }
}

export async function setCategoryActive(repos: Repositories, userId: string, id: string, isActive: boolean): Promise<Category> {
  return repos.categories.update(userId, id, { isActive });
}

export async function deleteCategory(repos: Repositories, userId: string, id: string): Promise<void> {
  await getCategory(repos, userId, id);
  try {
    await repos.categories.delete(userId, id);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "in_use") {
      throw new ServiceError("in_use", "This category is in use. Deactivate it instead.");
    }
    throw error;
  }
}
