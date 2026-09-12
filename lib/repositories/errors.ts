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

/** Map a Postgres SQLSTATE (as surfaced by PostgREST) to a code. */
export function fromPostgres(error: DriverError): RepositoryError {
  const message =
    [error.message, error.details, error.hint].filter((s): s is string => typeof s === "string" && s !== "").join(" — ") ||
    `database error${error.code ? ` (${error.code})` : ""}: ${JSON.stringify(error)}`;
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
