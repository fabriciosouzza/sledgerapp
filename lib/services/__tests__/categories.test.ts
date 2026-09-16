import { describe, expect, it } from "vitest";
import { categoryInputSchema } from "@/lib/schemas/categories";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../categories";
import { fakeRepositories } from "./fakes";

const input = (overrides: Record<string, unknown>) => categoryInputSchema.parse({ name: "X", appliesTo: ["expense"], ...overrides });

describe("categories", () => {
  it("nests one level only", async () => {
    const repos = fakeRepositories();
    const food = await createCategory(repos, "u1", input({ name: "Alimentação" }));
    const out = await createCategory(repos, "u1", input({ name: "Restaurantes", parentId: food.id }));
    await expect(createCategory(repos, "u1", input({ name: "Sushi", parentId: out.id }))).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects an unknown or foreign parent", async () => {
    const repos = fakeRepositories();
    const other = await createCategory(repos, "u2", input({ name: "Deles" }));
    await expect(createCategory(repos, "u1", input({ name: "X", parentId: other.id }))).rejects.toMatchObject({ code: "invalid" });
  });

  it("reports duplicate names as a conflict", async () => {
    const repos = fakeRepositories();
    await createCategory(repos, "u1", input({ name: "Lazer" }));
    await expect(createCategory(repos, "u1", input({ name: "Lazer" }))).rejects.toMatchObject({ code: "conflict" });
  });

  it("will not turn a parent into a child", async () => {
    const repos = fakeRepositories();
    const food = await createCategory(repos, "u1", input({ name: "Alimentação" }));
    const misc = await createCategory(repos, "u1", input({ name: "Outros" }));
    await createCategory(repos, "u1", input({ name: "Restaurantes", parentId: food.id }));
    await expect(updateCategory(repos, "u1", food.id, input({ name: "Alimentação", parentId: misc.id }))).rejects.toMatchObject({ code: "invalid" });
  });

  it("lists as a tree and refuses to delete a category with children", async () => {
    const repos = fakeRepositories();
    const misc = await createCategory(repos, "u1", input({ name: "Outros" }));
    const food = await createCategory(repos, "u1", input({ name: "Alimentação" }));
    await createCategory(repos, "u1", input({ name: "Restaurantes", parentId: food.id }));

    expect((await listCategories(repos, "u1")).map((c) => c.name)).toEqual(["Outros", "Alimentação", "Restaurantes"]);
    await expect(deleteCategory(repos, "u1", food.id)).rejects.toMatchObject({ code: "in_use" });
    await deleteCategory(repos, "u1", misc.id);
    expect(await repos.categories.count("u1")).toBe(2);
  });

  it("stores benefit flag and cap in cents", async () => {
    const repos = fakeRepositories();
    const va = await createCategory(repos, "u1", input({ name: "Vale", appliesTo: ["income"], isEarmarked: "on", monthlyCapCents: "800,00" }));
    expect(va).toMatchObject({ isEarmarked: true, monthlyCapCents: 80_000, appliesTo: ["income"] });
  });
});
