import { describe, expect, it } from "vitest";
import { accountInputSchema } from "@/lib/schemas/accounts";
import { createAccount, deleteAccount, updateAccount } from "../accounts";
import { ServiceError } from "../errors";
import { fakeRepositories } from "./fakes";

const card = accountInputSchema.parse({
  name: "Nubank",
  type: "credit_card",
  closingDay: "20",
  dueDay: "28",
  creditLimitCents: "5.000,00",
});

describe("accounts", () => {
  it("creates a card with its cycle days and limit in cents", async () => {
    const repos = fakeRepositories();
    const created = await createAccount(repos, "u1", card);
    expect(created).toMatchObject({ type: "credit_card", closingDay: 20, dueDay: 28, creditLimitCents: 500_000, sortOrder: 0 });
  });

  it("nulls card fields when the type is not a card", async () => {
    const repos = fakeRepositories();
    const created = await createAccount(repos, "u1", { ...card, type: "checking" });
    expect(created).toMatchObject({ closingDay: null, dueDay: null, creditLimitCents: null });
  });

  it("appends sort order and keeps it on update", async () => {
    const repos = fakeRepositories();
    const a = await createAccount(repos, "u1", { ...card, type: "checking", name: "A" });
    const b = await createAccount(repos, "u1", { ...card, type: "cash", name: "B" });
    expect([a.sortOrder, b.sortOrder]).toEqual([0, 1]);
    const updated = await updateAccount(repos, "u1", b.id, { ...card, type: "cash", name: "B2" });
    expect(updated.sortOrder).toBe(1);
  });

  it("refuses to delete an account in use", async () => {
    const repos = fakeRepositories();
    const a = await createAccount(repos, "u1", card);
    repos.accountsInUse.add(a.id);
    await expect(deleteAccount(repos, "u1", a.id)).rejects.toMatchObject({ code: "in_use" });
    await expect(deleteAccount(repos, "u2", a.id)).rejects.toBeInstanceOf(ServiceError);
  });

  it("validates card days in the schema", () => {
    const result = accountInputSchema.safeParse({ name: "X", type: "credit_card", closingDay: "", dueDay: "5" });
    expect(result.success).toBe(false);
    expect(accountInputSchema.safeParse({ name: "X", type: "checking" }).success).toBe(true);
  });
});
