// What a screen or action needs to call a service: who is asking and the
// repositories bound to this request. The only file that joins auth and db.

import { requireUser, type SessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/repositories";

export interface Context {
  user: SessionUser;
  userId: string;
  repos: Repositories;
}

export async function getContext(): Promise<Context> {
  const user = await requireUser();
  const db = await createClient();
  return { user, userId: user.id, repos: createRepositories(db) };
}

/** Repositories for a user already known (e.g. right after sign-in). */
export async function getRepositories(): Promise<Repositories> {
  return createRepositories(await createClient());
}
