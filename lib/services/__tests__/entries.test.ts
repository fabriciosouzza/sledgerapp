import { beforeEach, describe, expect, it } from "vitest";
import { entryInputSchema, entryUpdateSchema } from "@/lib/schemas/entries";
import { createEntry, deleteEntry, settleEntry, unsettleEntry, updateEntry } from "../entries";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-05";

let repos: FakeRepositories;
let checking: string;
let broker: string;
let food: string;
let misc: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  const accounts = await repos.accounts.list(U);
  checking = accounts.find((a) => a.name === "Conta Corrente")!.id;
  broker = accounts.find((a) => a.name === "Corretora")!.id;
  const categories = await repos.categories.list(U);
  food = categories.find((c) => c.name === "Alimentação")!.id;
  misc = categories.find((c) => c.name === "Outros")!.id;
});

const input = (overrides: Record<string, unknown>) =>
  entryInputSchema.parse({
    kind: "expense",
    amountCents: "149,90",
    date: "2026-10-15",
    description: "Notebook",
    categoryId: food,
    accountId: checking,
    ...overrides,
  });

describe("createEntry", () => {
  it("creates a planned expense by default and a settled one when already paid", async () => {
    const planned = await createEntry(repos, U, input({}), { today: TODAY });
    expect(planned.entries[0]).toMatchObject({ status: "planned", settledOn: null, amountCents: 14990, source: "manual" });

    const paid = await createEntry(repos, U, input({ settled: "on" }), { today: TODAY });
    expect(paid.entries[0]).toMatchObject({ status: "settled", settledOn: "2026-10-15" });
  });

  // Acceptance 9 at the service level: 12 numbered entries, one per month, one group id.
  it("expands an installment purchase into N rows sharing a group", async () => {
    const { entries } = await createEntry(repos, U, input({ installments: "on", installmentParts: "12" }), {
      today: TODAY,
      newId: () => "group-1",
    });
    expect(entries).toHaveLength(12);
    expect(entries.map((e) => e.installmentNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(entries.every((e) => e.installmentGroupId === "group-1" && e.installmentTotal === 12)).toBe(true);
    expect(entries[11].date).toBe("2027-09-15");
    expect(await repos.entries.list(U, { installmentGroupId: "group-1" })).toHaveLength(12);
  });

  it("drops the category on transfers and needs a counter account", async () => {
    const { entries } = await createEntry(
      repos,
      U,
      input({ kind: "transfer", categoryId: food, counterAccountId: broker, description: "Aporte" }),
      { today: TODAY },
    );
    expect(entries[0]).toMatchObject({ kind: "transfer", categoryId: null, counterAccountId: broker });

    expect(() => input({ kind: "transfer", counterAccountId: checking })).toThrow();
  });

  it("requires a brokerage counter account for contributions", async () => {
    const cash = (await repos.accounts.list(U)).find((a) => a.name === "Dinheiro")!.id;
    await expect(
      createEntry(repos, U, input({ kind: "contribution", counterAccountId: cash }), { today: TODAY }),
    ).rejects.toMatchObject({ code: "invalid" });
    const ok = await createEntry(repos, U, input({ kind: "contribution", counterAccountId: broker }), { today: TODAY });
    expect(ok.entries[0].kind).toBe("contribution");
  });

  it("rejects a category that does not apply to the kind", async () => {
    await expect(createEntry(repos, U, input({ kind: "income", categoryId: food }), { today: TODAY })).rejects.toMatchObject({
      code: "invalid",
    });
    const ok = await createEntry(repos, U, input({ kind: "income", categoryId: misc }), { today: TODAY });
    expect(ok.entries[0].kind).toBe("income");
  });

  it("rejects references to another user's rows", async () => {
    await seedUserIfEmpty(repos, "u2");
    const theirs = (await repos.accounts.list("u2"))[0].id;
    await expect(createEntry(repos, U, input({ accountId: theirs }), { today: TODAY })).rejects.toMatchObject({ code: "invalid" });
  });

  it("repeat monthly creates a template plus this month's entry, idempotently", async () => {
    const result = await createEntry(repos, U, input({ repeatMonthly: "on", description: "Aluguel", date: "2026-11-10" }), {
      today: TODAY,
    });
    expect(result.recurrence).toMatchObject({ dueDay: 10, startsOn: "2026-11-10", kind: "expense", amountCents: 14990 });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      source: "recurrence",
      recurrenceId: result.recurrence!.id,
      period: "2026-11-01",
      date: "2026-11-10",
      status: "planned",
    });
  });
});

describe("settle", () => {
  it("settles and unsettles keeping the invariant", async () => {
    const [entry] = (await createEntry(repos, U, input({}), { today: TODAY })).entries;
    const settled = await settleEntry(repos, U, entry.id, TODAY);
    expect(settled).toMatchObject({ status: "settled", settledOn: TODAY });
    const back = await unsettleEntry(repos, U, entry.id);
    expect(back).toMatchObject({ status: "planned", settledOn: null });
    await expect(settleEntry(repos, "u2", entry.id, TODAY)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("installment scopes", () => {
  const plan = async () =>
    (await createEntry(repos, U, input({ installments: "on", installmentParts: "4" }), { today: TODAY, newId: () => "g" })).entries;

  it("deletes this, this and future, or all", async () => {
    const parts = await plan();
    expect(await deleteEntry(repos, U, parts[1].id, "this")).toBe(1);
    expect((await repos.entries.list(U, { installmentGroupId: "g" })).map((e) => e.installmentNo)).toEqual([4, 3, 1]);

    expect(await deleteEntry(repos, U, parts[2].id, "this_and_future")).toBe(2);
    expect((await repos.entries.list(U, { installmentGroupId: "g" })).map((e) => e.installmentNo)).toEqual([1]);

    const again = await plan();
    void again;
    expect(await deleteEntry(repos, U, parts[0].id, "all")).toBe(5);
  });

  it("updates shared fields across the scope but the date only on the edited part", async () => {
    const parts = await plan();
    const updated = await updateEntry(
      repos,
      U,
      entryUpdateSchema.parse({
        id: parts[1].id,
        kind: "expense",
        amountCents: "200,00",
        date: "2026-11-20",
        description: "Notebook Dell",
        categoryId: food,
        accountId: checking,
        scope: "this_and_future",
      }),
    );
    expect(updated).toHaveLength(3);
    const group = (await repos.entries.list(U, { installmentGroupId: "g" })).sort((a, b) => a.installmentNo! - b.installmentNo!);
    expect(group.map((e) => e.amountCents)).toEqual([14990, 20000, 20000, 20000]);
    expect(group.map((e) => e.description)).toEqual(["Notebook", "Notebook Dell", "Notebook Dell", "Notebook Dell"]);
    expect(group.map((e) => e.date)).toEqual(["2026-10-15", "2026-11-20", "2026-12-15", "2027-01-15"]);
  });
});
