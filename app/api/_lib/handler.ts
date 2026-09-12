// Route handlers (PROMPT.md §4.3) call the same services as the server
// actions. This wrapper does what every handler needs: a signed-in user,
// repositories, JSON in, JSON out, and service errors as 4xx.

import { z } from "zod";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { firstIssue } from "@/lib/schemas/form";
import { ServiceError } from "@/lib/services/errors";

export interface ApiContext {
  userId: string;
  repos: Repositories;
}

const STATUS: Record<ServiceError["code"], number> = { not_found: 404, invalid: 422, conflict: 409, in_use: 409 };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function withUser(fn: (ctx: ApiContext) => Promise<Response>): Promise<Response> {
  const user = await getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  try {
    return await fn({ userId: user.id, repos: createRepositories(await createClient()) });
  } catch (error) {
    if (error instanceof ServiceError) return json({ error: error.message, code: error.code }, STATUS[error.code]);
    throw error;
  }
}

/** Parses a JSON body with a schema; `null` result means the response was already built. */
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<{ data: z.infer<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: json({ error: "Body must be JSON." }, 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { response: json({ error: firstIssue(parsed.error), issues: parsed.error.issues }, 400) };
  return { data: parsed.data };
}
