// Acceptance 16–18 at the service level: a contribution settles with its
// allocation, which becomes its paired movements; the default split of a
// recurrence pre-fills it; nothing is ever left without a destination.

import { beforeEach, describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/domain/metrics";
import { assetInputSchema } from "@/lib/schemas/assets";
import { entryInputSchema, entryUpdateSchema } from "@/lib/schemas/entries";
import { recurrenceInputSchema } from "@/lib/schemas/recurrences";
import { createEntry, deleteEntry, settleEntries, settleEntry, suggestAllocation, unsettleEntries, unsettleEntry, updateEntry } from "../entries";
import { netWorthOverview } from "../netWorth";
import { createAsset, deleteMovement, portfolioOverview, updateMovement } from "../portfolio";
import { createRecurrence, generateMonth } from "../recurrences";
import { seedUserIfEmpty } from "../seed";
import { todayOverview } from "../today";
import { fakeRepositories, type FakeRepositories } from "./fakes";
import { movementUpdateSchema } from "@/lib/schemas/assets";

const U = "u1";
const TODAY = "2026-11-05";

let repos: FakeRepositories;
let checking: string;
let selic: string;
let btc: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  const accounts = await repos.accounts.list(U);
  checking = accounts.find((a) => a.name === "Conta Corrente")!.id;
  await repos.accounts.update(U, checking, { openingBalanceCents: 500_000, openingOn: "2026-01-01" });
  selic = (await createAsset(repos, U, assetInputSchema.parse({ name: "Tesouro Selic", assetClass: "fixed_income" }))).id;
  btc = (await createAsset(repos, U, assetInputSchema.parse({ name: "Bitcoin", assetClass: "crypto" }))).id;
});

const contribution = (overrides: Record<string, unknown> = {}) =>
  entryInputSchema.parse({ kind: "contribution", amountCents: "1.000,00", date: "2026-11-05", accountId: checking, ...overrides });

describe("settling a contribution", () => {
  it("creates one paired movement per asset, summing to the entry, and unsettling removes them", async () => {
    const { entries } = await createEntry(repos, U, contribution(), { today: TODAY });
    const entry = entries[0];
    expect(entry.status).toBe("planned");

    await expect(settleEntry(repos, U, entry.id, TODAY)).rejects.toMatchObject({ code: "invalid" });
    await expect(settleEntry(repos, U, entry.id, TODAY, [{ assetId: selic, amountCents: 60_000 }])).rejects.toMatchObject({ code: "invalid" });

    const settled = await settleEntry(repos, U, entry.id, TODAY, [
      { assetId: selic, amountCents: 60_000 },
      { assetId: btc, amountCents: 40_000 },
    ]);
    expect(settled.status).toBe("settled");
    const movements = await repos.movements.listByEntry(U, entry.id);
    expect(movements.map((m) => [m.assetId, m.kind, m.amountCents, m.date])).toEqual([
      [selic, "contribution", 60_000, TODAY],
      [btc, "contribution", 40_000, TODAY],
    ]);

    // Acceptance 17: cash went down by the contribution; the portfolio holds it; net worth is unchanged.
    const worth = await netWorthOverview(repos, U, TODAY);
    expect(worth.cashCents).toBe(400_000);
    expect(worth.current.investmentsCents).toBe(100_000);
    expect(worth.current.netWorthCents).toBe(500_000);
    const m = computeMetrics({ entries: await repos.entries.list(U, { period: "2026-11" }), categories: [], recurrences: [], cashCents: null });
    expect(m.expenseCents).toBe(0);
    expect(m.contributionsCents).toBe(100_000);

    await unsettleEntry(repos, U, entry.id);
    expect(await repos.movements.listByEntry(U, entry.id)).toEqual([]);
    expect((await netWorthOverview(repos, U, TODAY)).cashCents).toBe(500_000);
  });

  it("is born allocated when created already paid, and names the single asset", async () => {
    const { entries } = await createEntry(repos, U, contribution({ settled: "on", allocation: [{ assetId: selic, amountCents: "1.000,00" }] }), { today: TODAY });
    expect(entries[0]).toMatchObject({ status: "settled", description: "Aporte Tesouro Selic" });
    expect(await repos.movements.listByEntry(U, entries[0].id)).toHaveLength(1);
    expect((await portfolioOverview(repos, U, TODAY)).unallocated).toEqual([]);
  });

  it("stays out of bulk settle, and bulk unsettle takes allocations with it", async () => {
    const { entries } = await createEntry(repos, U, contribution(), { today: TODAY });
    await expect(settleEntries(repos, U, [entries[0].id], TODAY)).rejects.toMatchObject({ code: "invalid" });
    await settleEntry(repos, U, entries[0].id, TODAY, [{ assetId: btc, amountCents: 100_000 }]);
    await unsettleEntries(repos, U, [entries[0].id]);
    expect(await repos.movements.list(U)).toEqual([]);
    // Today never offers a contribution for blind settling.
    const overview = await todayOverview(repos, U, TODAY);
    expect(overview.dueToday).toEqual([]);
    expect(overview.upcoming.map((e) => e.id)).toEqual([entries[0].id]);
  });
});

describe("editing a settled contribution", () => {
  it("re-allocates when a split is sent, follows the amount for a single asset, and drops the split when unsettled", async () => {
    const { entries } = await createEntry(repos, U, contribution({ settled: "on", allocation: [{ assetId: selic, amountCents: "1.000,00" }] }), { today: TODAY });
    const base = { id: entries[0].id, kind: "contribution", description: "Aporte", accountId: checking, settled: "on", scope: "this", date: "2026-11-05" };

    await updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "1.200,00" }));
    expect((await repos.movements.listByEntry(U, entries[0].id)).map((m) => m.amountCents)).toEqual([120_000]);

    await updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "1.200,00", allocation: [{ assetId: selic, amountCents: "700,00" }, { assetId: btc, amountCents: "500,00" }] }));
    expect((await repos.movements.listByEntry(U, entries[0].id)).map((m) => [m.assetId, m.amountCents])).toEqual([[selic, 70_000], [btc, 50_000]]);

    // Split across two assets: the amount can only change with a new split.
    await expect(updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "900,00" }))).rejects.toMatchObject({ code: "invalid" });
    // The portfolio side of a split is edited from the entry, not part by part.
    const [first] = await repos.movements.listByEntry(U, entries[0].id);
    await expect(updateMovement(repos, U, movementUpdateSchema.parse({ id: first.id, kind: "contribution", date: TODAY, amountCents: "1,00" }))).rejects.toMatchObject({ code: "invalid" });
    await expect(deleteMovement(repos, U, first.id)).rejects.toMatchObject({ code: "invalid" });

    await updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "1.200,00", settled: "" }));
    expect(await repos.movements.listByEntry(U, entries[0].id)).toEqual([]);

    await deleteEntry(repos, U, entries[0].id);
    expect(await repos.entries.getById(U, entries[0].id)).toBeNull();
  });
});

describe("the default split of a recurring contribution", () => {
  it("pre-fills the allocation of a generated month, adding up exactly", async () => {
    const recurrence = await createRecurrence(
      repos,
      U,
      recurrenceInputSchema.parse({
        description: "Aporte mensal",
        kind: "contribution",
        accountId: checking,
        amountCents: "1.000,01",
        dueDay: "5",
        startsOn: "2026-01-01",
        allocations: [
          { assetId: selic, sharePercent: "70" },
          { assetId: btc, sharePercent: "30" },
        ],
      }),
    );
    expect(recurrence.allocations).toEqual([
      { assetId: selic, sharePercent: 70 },
      { assetId: btc, sharePercent: 30 },
    ]);
    await generateMonth(repos, U, "2026-11");
    const [planned] = await repos.entries.list(U, { period: "2026-11" });
    const suggestion = await suggestAllocation(repos, U, planned.id);
    expect(suggestion.lines).toEqual([
      { assetId: selic, amountCents: 70_001 },
      { assetId: btc, amountCents: 30_000 },
    ]);
    expect(suggestion.assets.map((a) => a.id)).toEqual([selic, btc]);
  });

  it("rejects shares that do not sum to 100, and ignores them on other kinds", async () => {
    const base = { description: "X", accountId: checking, amountCents: "10,00", dueDay: "5", startsOn: "2026-01-01" };
    await expect(createRecurrence(repos, U, recurrenceInputSchema.parse({ ...base, kind: "contribution", allocations: [{ assetId: selic, sharePercent: "60" }] }))).rejects.toMatchObject({ code: "invalid" });
    const misc = (await repos.categories.list(U)).find((c) => c.name === "Outros")!.id;
    const expense = await createRecurrence(repos, U, recurrenceInputSchema.parse({ ...base, kind: "expense", categoryId: misc, allocations: [{ assetId: selic, sharePercent: "60" }] }));
    expect(expense.allocations).toEqual([]);
  });

  it("is learnt from a contribution saved with 'repeat monthly'", async () => {
    const { recurrence } = await createEntry(
      repos,
      U,
      contribution({ settled: "on", repeatMonthly: "on", allocation: [{ assetId: selic, amountCents: "750,00" }, { assetId: btc, amountCents: "250,00" }] }),
      { today: TODAY },
    );
    expect(recurrence?.allocations).toEqual([
      { assetId: selic, sharePercent: 75 },
      { assetId: btc, sharePercent: 25 },
    ]);
  });

  it("suggests the only asset when there is one and nothing when there are many", async () => {
    const { entries } = await createEntry(repos, U, contribution(), { today: TODAY });
    expect((await suggestAllocation(repos, U, entries[0].id)).lines).toEqual([]);
    await repos.assets.update(U, btc, { isActive: false });
    expect((await suggestAllocation(repos, U, entries[0].id)).lines).toEqual([{ assetId: selic, amountCents: 100_000 }]);
  });
});

describe("unallocated money", () => {
  it("is reported by the portfolio, never hidden", async () => {
    const { entries } = await createEntry(repos, U, contribution({ settled: "on", allocation: [{ assetId: selic, amountCents: "1.000,00" }] }), { today: TODAY });
    // Something outside the app removed the portfolio side.
    await repos.movements.deleteByEntry(U, entries[0].id);
    const overview = await portfolioOverview(repos, U, TODAY);
    expect(overview.unallocated).toEqual([{ entry: expect.objectContaining({ id: entries[0].id }), allocatedCents: 0 }]);
  });
});
