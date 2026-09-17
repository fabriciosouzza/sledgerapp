import { beforeEach, describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/domain/metrics";
import { assetInputSchema, movementInputSchema, movementUpdateSchema } from "@/lib/schemas/assets";
import { addMovement, assetBalances, createAsset, deleteAsset, deleteMovement, portfolioOverview, recordBatch, updateMovement } from "../portfolio";
import { entryUpdateSchema } from "@/lib/schemas/entries";
import { deleteEntry, updateEntry } from "../entries";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-10";
let repos: FakeRepositories;
let checking: string;
let cdb: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  const accounts = await repos.accounts.list(U);
  checking = accounts.find((a) => a.name === "Conta Corrente")!.id;
  cdb = (await createAsset(repos, U, assetInputSchema.parse({ name: "CDB 110%", assetClass: "fixed_income" }))).id;
});

const move = (overrides: Record<string, unknown>) =>
  movementInputSchema.parse({ assetId: cdb, kind: "yield", date: "2026-11-05", amountCents: "10,00", ...overrides });

describe("addMovement", () => {
  it("pairs a contribution with a settled contribution entry", async () => {
    const movement = await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00", cashAccountId: checking }));
    expect(movement.entryId).not.toBeNull();
    const entry = (await repos.entries.getById(U, movement.entryId!))!;
    expect(entry).toMatchObject({ kind: "contribution", status: "settled", amountCents: 100_000, accountId: checking, counterAccountId: null, description: "Aporte CDB 110%" });

    // Acceptance 1 again, end to end: the contribution is not an expense.
    const m = computeMetrics({ entries: await repos.entries.list(U, { period: "2026-11" }), categories: [], recurrences: [], cashCents: null });
    expect(m.expenseCents).toBe(0);
    expect(m.contributionsCents).toBe(100_000);
  });

  // Acceptance 4: yield enters neither income nor the savings rate.
  it("records yield without touching entries", async () => {
    await addMovement(repos, U, move({ kind: "yield", amountCents: "50,00" }));
    expect(await repos.entries.list(U, { period: "2026-11" })).toHaveLength(0);
    const overview = await portfolioOverview(repos, U, TODAY);
    expect(overview.total).toMatchObject({ contributedCents: 0, earnedCents: 5_000, balanceCents: 5_000, returnRate: null });
  });

  it("allows a negative market adjustment only", async () => {
    await addMovement(repos, U, move({ kind: "market_adjustment", amountCents: "-30,00" }));
    expect(() => move({ kind: "withdrawal", amountCents: "-30,00" })).toThrow();
    const overview = await portfolioOverview(repos, U, TODAY);
    expect(overview.total.balanceCents).toBe(-3_000);
  });

  it("pairs only with a cash account", async () => {
    const card = await repos.accounts.insert(U, { name: "Card", type: "credit_card", institution: null, closingDay: 5, dueDay: 15, creditLimitCents: null, openingBalanceCents: 0, openingOn: "2026-01-01", targetCents: null, isActive: true, sortOrder: 9 });
    await expect(addMovement(repos, U, move({ kind: "contribution", amountCents: "1,00", cashAccountId: card.id }))).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("portfolioOverview", () => {
  it("separates contributed from earned per asset and by class", async () => {
    const btc = (await createAsset(repos, U, assetInputSchema.parse({ name: "BTC", assetClass: "crypto" }))).id;
    await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00", date: "2026-09-01" }));
    await addMovement(repos, U, move({ kind: "yield", amountCents: "12,00", date: "2026-10-01" }));
    await addMovement(repos, U, move({ assetId: btc, kind: "contribution", amountCents: "500,00", date: "2026-10-15" }));
    await addMovement(repos, U, move({ assetId: btc, kind: "market_adjustment", amountCents: "-80,00", date: "2026-11-01" }));

    const overview = await portfolioOverview(repos, U, TODAY, 3);
    expect(overview.total).toEqual({ contributedCents: 150_000, earnedCents: -6_800, balanceCents: 143_200, returnRate: -6_800 / 150_000 });
    expect(overview.byClass).toEqual([
      { assetClass: "fixed_income", balanceCents: 101_200 },
      { assetClass: "crypto", balanceCents: 42_000 },
    ]);
    expect(overview.assets.map((a) => a.asset.name)).toEqual(["CDB 110%", "BTC"]);
    expect(overview.series.map((p) => p.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(overview.series[2]).toEqual({ period: "2026-11", contributedCents: 150_000, earnedCents: -6_800 });
  });
});

describe("withdrawal", () => {
  // Acceptance 17: a redemption reaches cash and is not income.
  it("pairs with a redemption into the cash account", async () => {
    await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00", cashAccountId: checking }));
    const out = await addMovement(repos, U, move({ kind: "withdrawal", amountCents: "300,00", date: "2026-11-08", cashAccountId: checking }));
    const entry = (await repos.entries.getById(U, out.entryId!))!;
    expect(entry).toMatchObject({ kind: "redemption", accountId: checking, counterAccountId: null, amountCents: 30_000, status: "settled", description: "Resgate CDB 110%" });
    expect((await portfolioOverview(repos, U, TODAY)).total.balanceCents).toBe(70_000);
    const m = computeMetrics({ entries: await repos.entries.list(U, { period: "2026-11" }), categories: [], recurrences: [], cashCents: null });
    expect(m.incomeCents).toBe(0);
    expect(m.redemptionsCents).toBe(30_000);
    expect(m.leftoverCents).toBe(-100_000 + 30_000);
  });
});

describe("assetBalances", () => {
  it("honours the sign of every movement kind, as the broker-balance hint relies on it", async () => {
    await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00" }));
    await addMovement(repos, U, move({ kind: "yield", amountCents: "10,00" }));
    await addMovement(repos, U, move({ kind: "withdrawal", amountCents: "200,00" }));
    await addMovement(repos, U, move({ kind: "fee_tax", amountCents: "5,00" }));
    await addMovement(repos, U, move({ kind: "market_adjustment", amountCents: "-30,00" }));
    expect(await assetBalances(repos, U)).toEqual({ [cdb]: 100_000 + 1_000 - 20_000 - 500 - 3_000 });
  });
});

describe("updateMovement", () => {
  it("edits amount and date, and the paired entry follows", async () => {
    const movement = await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00", cashAccountId: checking }));
    const updated = await updateMovement(repos, U, movementUpdateSchema.parse({ id: movement.id, kind: "contribution", date: "2026-11-20", amountCents: "1.250,00" }));
    expect(updated).toMatchObject({ amountCents: 125_000, date: "2026-11-20" });
    expect(await repos.entries.getById(U, movement.entryId!)).toMatchObject({ amountCents: 125_000, date: "2026-11-20", settledOn: "2026-11-20" });
    await expect(updateMovement(repos, U, movementUpdateSchema.parse({ id: movement.id, kind: "yield", date: "2026-11-20", amountCents: "1,00" }))).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("the entry side of a pair", () => {
  it("edits and deletes reach the movement", async () => {
    const movement = await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00", cashAccountId: checking }));
    const base = { id: movement.entryId!, kind: "contribution", description: "Aporte", accountId: checking, settled: "on", scope: "this" };
    await updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "900,00", date: "2026-11-07" }));
    expect(await repos.movements.getById(U, movement.id)).toMatchObject({ amountCents: 90_000, date: "2026-11-07" });
    const savings = (await repos.accounts.list(U)).find((a) => a.name === "Reserva")!.id;
    await expect(updateEntry(repos, U, entryUpdateSchema.parse({ ...base, kind: "transfer", counterAccountId: savings, amountCents: "900,00", date: "2026-11-07" }))).rejects.toMatchObject({ code: "invalid" });
    await deleteEntry(repos, U, movement.entryId!);
    expect(await repos.movements.getById(U, movement.id)).toBeNull();
  });
});

describe("delete", () => {
  it("removes a paired entry with its movement, and protects assets in use", async () => {
    const movement = await addMovement(repos, U, move({ kind: "contribution", amountCents: "1,00", cashAccountId: checking }));
    await expect(deleteAsset(repos, U, cdb)).rejects.toMatchObject({ code: "in_use" });
    await deleteMovement(repos, U, movement.id);
    expect(await repos.entries.getById(U, movement.entryId!)).toBeNull();
    await deleteAsset(repos, U, cdb);
    expect(await repos.assets.list(U)).toHaveLength(0);
  });
});

describe("recordBatch", () => {
  it("takes each line's own kind, so fixed income yields and crypto is adjusted in the same pass", async () => {
    const repos = fakeRepositories();
    const cdb = await createAsset(repos, U, assetInputSchema.parse({ name: "CDB", assetClass: "fixed_income" }));
    const btc = await createAsset(repos, U, assetInputSchema.parse({ name: "BTC", assetClass: "crypto" }));
    const created = await recordBatch(repos, U, {
      kind: "yield",
      date: "2026-02-01",
      mode: "amount",
      values: [
        { assetId: cdb.id, cents: 1_000, kind: "yield" },
        { assetId: btc.id, cents: 5_000, kind: "market_adjustment" },
        { assetId: btc.id, cents: -200 }, // no kind of its own: falls back, and a drop is never a yield anyway
      ],
    });
    expect(created.map((m) => [m.assetId, m.kind, m.amountCents])).toEqual([
      [cdb.id, "yield", 1_000],
      [btc.id, "market_adjustment", 5_000],
      [btc.id, "market_adjustment", -200],
    ]);
  });

  it("records the difference from the broker balance and skips unchanged lines", async () => {
    const repos = fakeRepositories();
    const a = await createAsset(repos, U, assetInputSchema.parse({ name: "CDB", assetClass: "fixed_income" }));
    const b = await createAsset(repos, U, assetInputSchema.parse({ name: "ETF", assetClass: "stocks" }));
    await repos.movements.insert(U, { assetId: a.id, date: "2026-01-01", kind: "contribution", amountCents: 100_000, entryId: null, notes: null });
    await repos.movements.insert(U, { assetId: b.id, date: "2026-01-01", kind: "contribution", amountCents: 50_000, entryId: null, notes: null });

    const created = await recordBatch(repos, U, {
      kind: "market_adjustment",
      date: "2026-02-01",
      mode: "balance",
      values: [
        { assetId: a.id, cents: 101_500 },
        { assetId: b.id, cents: 50_000 },
      ],
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ assetId: a.id, kind: "market_adjustment", amountCents: 1_500 });
    expect(await assetBalances(repos, U)).toEqual({ [a.id]: 101_500, [b.id]: 50_000 });

    const down = await recordBatch(repos, U, { kind: "yield", date: "2026-02-01", mode: "balance", values: [{ assetId: b.id, cents: 49_000 }] });
    expect(down[0]).toMatchObject({ kind: "market_adjustment", amountCents: -1_000 });
  });
});
