import { beforeEach, describe, expect, it } from "vitest";
import { recurrenceInputSchema } from "@/lib/schemas/recurrences";
import { createRecurrence, deleteRecurrence, fixedCost, generateMonth, pendingMonths, previewGeneration } from "../recurrences";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
let repos: FakeRepositories;
let checking: string;
let housing: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  checking = (await repos.accounts.list(U)).find((a) => a.name === "Conta Corrente")!.id;
  housing = (await repos.categories.list(U)).find((c) => c.name === "Moradia")!.id;
});

const input = (overrides: Record<string, unknown> = {}) =>
  recurrenceInputSchema.parse({
    description: "Aluguel",
    kind: "expense",
    categoryId: housing,
    accountId: checking,
    amountCents: "1.500,00",
    dueDay: "31",
    startsOn: "2026-01-01",
    ...overrides,
  });

describe("generateMonth", () => {
  it("leaves skipped templates out", async () => {
    const rent = await createRecurrence(repos, U, input());
    await createRecurrence(repos, U, input({ description: "Internet", amountCents: "120,00", dueDay: "10" }));
    expect(await generateMonth(repos, U, "2026-02", {}, [rent.id])).toEqual({ period: "2026-02", created: 1, skipped: 0 });
    expect((await repos.entries.list(U, { period: "2026-02" })).map((e) => e.description)).toEqual(["Internet"]);
  });

  it("lists the recent months still to apply", async () => {
    await createRecurrence(repos, U, input({ startsOn: "2026-05-01" }));
    await generateMonth(repos, U, "2026-07");
    expect(await pendingMonths(repos, U, "2026-09-12")).toEqual([
      { period: "2026-06", count: 1, applied: 0 },
      { period: "2026-08", count: 1, applied: 0 },
      { period: "2026-09", count: 1, applied: 0 },
    ]);
    await generateMonth(repos, U, "2026-06");
    await generateMonth(repos, U, "2026-08");
    expect(await pendingMonths(repos, U, "2026-09-12")).toEqual([{ period: "2026-09", count: 1, applied: 0 }]);
  });

  // Acceptance 6: generating the same month twice creates nothing the second time.
  it("is idempotent", async () => {
    await createRecurrence(repos, U, input());
    await createRecurrence(repos, U, input({ description: "Internet", amountCents: "120,00", dueDay: "10" }));

    const first = await generateMonth(repos, U, "2026-02");
    expect(first).toEqual({ period: "2026-02", created: 2, skipped: 0 });

    const second = await generateMonth(repos, U, "2026-02");
    expect(second).toEqual({ period: "2026-02", created: 0, skipped: 2 });
    expect(await repos.entries.list(U, { period: "2026-02" })).toHaveLength(2);
  });

  // Acceptance 8 at the service level: day 31 in February.
  it("clamps the due day and tags rows with recurrence and period", async () => {
    const rent = await createRecurrence(repos, U, input());
    await generateMonth(repos, U, "2026-02");
    const [row] = await repos.entries.list(U, { period: "2026-02" });
    expect(row).toMatchObject({ date: "2026-02-28", recurrenceId: rent.id, period: "2026-02-01", status: "planned", source: "recurrence" });
  });

  // Acceptance 7: outside starts_on / ends_on nothing is generated.
  it("respects the template's window and active flag", async () => {
    await createRecurrence(repos, U, input({ startsOn: "2026-03-01" }));
    await createRecurrence(repos, U, input({ description: "Antigo", endsOn: "2025-12-31", startsOn: "2025-01-01" }));
    await createRecurrence(repos, U, input({ description: "Pausado", isActive: "false" }));
    expect(await generateMonth(repos, U, "2026-02")).toMatchObject({ created: 0 });
    expect(await generateMonth(repos, U, "2026-03")).toMatchObject({ created: 1 });
  });

  it("takes per-month amounts for variable bills without touching the template", async () => {
    const water = await createRecurrence(repos, U, input({ description: "Água", amountCents: "80,00", isVariable: "on" }));
    await generateMonth(repos, U, "2026-02", { [water.id]: 9_350 });
    const [row] = await repos.entries.list(U, { period: "2026-02" });
    expect(row.amountCents).toBe(9_350);
    expect((await repos.recurrences.getById(U, water.id))!.amountCents).toBe(8_000);
    await expect(generateMonth(repos, U, "2026-03", { [water.id]: -1 })).rejects.toMatchObject({ code: "invalid" });
  });

  it("previews what is missing and what already exists", async () => {
    await createRecurrence(repos, U, input());
    const internet = await createRecurrence(repos, U, input({ description: "Internet", dueDay: "10" }));
    await generateMonth(repos, U, "2026-02");
    await createRecurrence(repos, U, input({ description: "Luz", dueDay: "15" }));

    const preview = await previewGeneration(repos, U, "2026-02");
    expect(preview.existing.map((e) => e.recurrenceId)).toContain(internet.id);
    expect(preview.toCreate.map((r) => r.description)).toEqual(["Luz"]);
  });
});

describe("recurrences", () => {
  it("sums the monthly fixed cost from active expenses only", async () => {
    await createRecurrence(repos, U, input());
    await createRecurrence(repos, U, input({ description: "Off", isActive: "false" }));
    const misc = (await repos.categories.list(U)).find((c) => c.name === "Outros")!.id;
    await createRecurrence(repos, U, input({ description: "Salário", kind: "income", categoryId: misc, amountCents: "5.000,00" }));
    expect(await fixedCost(repos, U)).toBe(150_000);
  });

  it("deleting a template keeps generated entries, unlinked", async () => {
    const rent = await createRecurrence(repos, U, input());
    await generateMonth(repos, U, "2026-02");
    await deleteRecurrence(repos, U, rent.id);
    const [row] = await repos.entries.list(U, { period: "2026-02" });
    expect(row.recurrenceId).toBeNull();
    await expect(deleteRecurrence(repos, U, rent.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
