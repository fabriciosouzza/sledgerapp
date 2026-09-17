import { describe, expect, it } from "vitest";
import { missingSeedCategories, seedMissingCategories, seedUserIfEmpty } from "../seed";
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
      "Assinaturas", "Lazer", "Dívidas e parcelas",
      "Salário", "Extras", "Reembolso", "Cashback", "Vale-refeição", "Outros",
    ]);
    expect(categories.every((c) => c.monthlyCapCents === null && c.parentId === null)).toBe(true);
    expect(categories.find((c) => c.name === "Salário")).toMatchObject({ appliesTo: ["income"], isEarmarked: false });
    // The voucher is the one that is both in and out, and earmarked (§5.8).
    expect(categories.find((c) => c.name === "Vale-refeição")).toMatchObject({ appliesTo: ["income", "expense"], isEarmarked: true });
    expect(categories.filter((c) => c.isEarmarked).map((c) => c.name)).toEqual(["Vale-refeição"]);
  });

  it("adds only the starter categories an older account is missing, after its own", async () => {
    const repos = fakeRepositories();
    await seedUserIfEmpty(repos, "u1");
    const all = await repos.categories.list("u1");
    // An account from before the income categories existed: drop them, keep a custom one.
    for (const c of all) if (["Salário", "Extras", "Reembolso", "Cashback", "Vale-refeição"].includes(c.name)) await repos.categories.delete("u1", c.id);
    await repos.categories.insert("u1", { ...all[0], name: "Pets", sortOrder: 40 });
    expect((await missingSeedCategories(repos, "u1")).map((c) => c.name)).toEqual(["Salário", "Extras", "Reembolso", "Cashback", "Vale-refeição"]);
    expect(await seedMissingCategories(repos, "u1")).toEqual({ added: 5 });
    expect(await missingSeedCategories(repos, "u1")).toEqual([]);
    expect(await seedMissingCategories(repos, "u1")).toEqual({ added: 0 });
    const salary = (await repos.categories.list("u1")).find((c) => c.name === "Salário")!;
    expect(salary.sortOrder).toBeGreaterThan(40);
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
