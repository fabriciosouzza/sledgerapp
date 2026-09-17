"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/services/context";
import { seedMissingCategories, seedUserIfEmpty } from "@/lib/services/seed";

/** The starting set (§10), for a user whose sign-in seed did not run. */
export async function seedStartingSetAction(): Promise<{ seeded: boolean }> {
  const { userId, repos } = await getContext();
  const result = await seedUserIfEmpty(repos, userId);
  for (const path of ["/settings/accounts", "/settings/categories", "/add", "/"]) revalidatePath(path);
  return result;
}

/** The starter categories added since this account was created (or removed by hand and wanted back). */
export async function seedMissingCategoriesAction(names?: string[]): Promise<{ added: number }> {
  const { userId, repos } = await getContext();
  const result = await seedMissingCategories(repos, userId, names);
  for (const path of ["/settings/categories", "/add", "/review"]) revalidatePath(path);
  return result;
}
