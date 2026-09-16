import { describe, expect, it } from "vitest";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories } from "./fakes";

describe("seedUserIfEmpty", () => {
  it("creates the starting accounts and categories, no cards, no entries", async () => {
    const repos = fakeRepositories();
    const result = await seedUserIfEmpty(repos, "u1");

    expect(result.seeded).toBe(true);
    const accounts = await repos.accounts.list("u1");
    const categories = await repos.categories.list("u1");
    expect(accounts.map((a) => a.name)).toEqual(["Conta Corrente", "Dinheiro", "Reserva"]);
    expect(accounts.some((a) => a.type === "credit_card")).toBe(false);
    expect(categories.map((c) => c.name)).toEqual([
      "Moradia", "Alimentação", "Transporte", "Saúde", "Educação",
      "Assinaturas", "Lazer", "Dívidas e parcelas", "Outros",
    ]);
    expect(categories.every((c) => c.monthlyCapCents === null && c.parentId === null)).toBe(true);
  });

  it("does nothing the second time, and nothing for a user who already has data", async () => {
    const repos = fakeRepositories();
    await seedUserIfEmpty(repos, "u1");
    expect(await seedUserIfEmpty(repos, "u1")).toEqual({ seeded: false });
    expect(await repos.accounts.count("u1")).toBe(3);

    await repos.accounts.insert("u2", { ...(await repos.accounts.list("u1"))[0], name: "Minha" });
    expect(await seedUserIfEmpty(repos, "u2")).toEqual({ seeded: false });
    expect(await repos.categories.count("u2")).toBe(0);
  });

  it("is per user", async () => {
    const repos = fakeRepositories();
    await seedUserIfEmpty(repos, "u1");
    await seedUserIfEmpty(repos, "u2");
    expect(await repos.accounts.count("u1")).toBe(3);
    expect(await repos.accounts.count("u2")).toBe(3);
  });
});
