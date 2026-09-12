// What a service returns when the operation cannot be done and the UI should
// explain why. Anything else (a driver failure, a bug) is thrown.

export class ServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "in_use" | "conflict" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
