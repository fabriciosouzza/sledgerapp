// Category rules: one level of nesting (§6), and a category applies to the
// kinds it lists (null means any).

import type { Category, EntryKind } from "./types";

export function isTopLevel(category: Pick<Category, "parentId">): boolean {
  return category.parentId === null;
}

/** A parent must be top-level, so the tree never goes deeper than one level. */
export function canBeParent(candidate: Pick<Category, "id" | "parentId">, childId: string | null): boolean {
  return isTopLevel(candidate) && candidate.id !== childId;
}

export function appliesToKind(category: Pick<Category, "appliesTo">, kind: EntryKind): boolean {
  return category.appliesTo === null || category.appliesTo.length === 0 || category.appliesTo.includes(kind);
}

/** Top-level categories first, each followed by its children, all sorted by sort order then name. */
export function sortCategoryTree<T extends Pick<Category, "id" | "parentId" | "sortOrder" | "name">>(categories: T[]): T[] {
  const byOrder = (a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR");
  const roots = categories.filter(isTopLevel).sort(byOrder);
  const children = new Map<string, T[]>();
  for (const c of categories) {
    if (c.parentId === null) continue;
    const list = children.get(c.parentId) ?? [];
    list.push(c);
    children.set(c.parentId, list);
  }
  const out: T[] = [];
  for (const root of roots) {
    out.push(root, ...(children.get(root.id) ?? []).sort(byOrder));
  }
  // Orphans (parent missing) still show up rather than vanish.
  for (const c of categories) if (!out.includes(c)) out.push(c);
  return out;
}
