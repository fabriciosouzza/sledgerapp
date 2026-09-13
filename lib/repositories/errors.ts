// Errors a repository may throw. Services turn them into outcomes the UI can
// explain; nothing above this layer sees a database driver's error shape.

export type RepositoryErrorCode = "not_found" | "in_use" | "conflict" | "invalid" | "unknown";

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

interface DriverError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/** Map a Postgres SQLSTATE (as surfaced by PostgREST) to a code. `http` is the response status, for errors that come without a body. */
export function fromPostgres(error: DriverError, http?: { status: number; statusText: string }): RepositoryError {
  const message =
    [error.message, error.details, error.hint].filter((s): s is string => typeof s === "string" && s !== "").join(" — ") ||
    `database error${error.code ? ` (${error.code})` : ""}${http ? ` HTTP ${http.status} ${http.statusText}` : ""}: ${JSON.stringify(error)}`;
  switch (error.code) {
    case "23503":
      return new RepositoryError("in_use", message);
    case "23505":
      return new RepositoryError("conflict", message);
    case "23514":
      return new RepositoryError("invalid", message);
    case "PGRST116":
      return new RepositoryError("not_found", message);
    default:
      return new RepositoryError("unknown", message);
  }
}

/** One page of rows from a PostgREST query builder (anything with `.range()` that resolves to `{ data, error }`). */
interface PageQuery<Row> {
  range(from: number, to: number): PromiseLike<{ data: Row[] | null; error: DriverError | null }>;
}

/**
 * PostgREST caps every response at `max_rows` (1000 by default) and says
 * nothing when it does. Unbounded lists — every settled entry of an account,
 * every movement — must page until a short page comes back. `query` builds a
 * fresh builder each time: `.range()` mutates the one it is called on.
 */
export const PAGE_SIZE = 1000;

export async function fetchAll<Row>(query: () => PageQuery<Row>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().range(from, from + PAGE_SIZE - 1);
    if (error) throw fromPostgres(error);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
