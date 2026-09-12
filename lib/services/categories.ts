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
