"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/services/context";
import { seedUserIfEmpty } from "@/lib/services/seed";

/** The starting set (§10), for a user whose sign-in seed did not run. */
export async function seedStartingSetAction(): Promise<{ seeded: boolean }> {
  const { userId, repos } = await getContext();
  const result = await seedUserIfEmpty(repos, userId);
  for (const path of ["/settings/accounts", "/settings/categories", "/add", "/"]) revalidatePath(path);
  return result;
}
