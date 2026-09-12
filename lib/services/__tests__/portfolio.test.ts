import { beforeEach, describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/domain/metrics";
import { assetInputSchema, movementInputSchema } from "@/lib/schemas/assets";
import { addMovement, createAsset, deleteAsset, deleteMovement, portfolioOverview } from "../portfolio";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-10";
let repos: FakeRepositories;
let checking: string;
let broker: string;
let cdb: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  const accounts = await repos.accounts.list(U);
  checking = accounts.find((a) => a.name === "Conta Corrente")!.id;
  broker = accounts.find((a) => a.name === "Corretora")!.id;
  cdb = (await createAsset(repos, U, assetInputSchema.parse({ name: "CDB 110%", assetClass: "fixed_income" }))).id;
});

const move = (overrides: Record<string, unknown>) =>
  movementInputSchema.parse({ assetId: cdb, kind: "yield", date: "2026-11-05", amountCents: "10,00", ...overrides });

describe("addMovement", () => {
  it("pairs a contribution with a settled contribution entry", async () => {
    const movement = await addMovement(repos, U, move({ kind: "contribution", amountCents: "1.000,00", fromAccountId: checking, brokerageAccountId: broker }));
    expect(movement.entryId).not.toBeNull();
    const entry = (await repos.entries.getById(U, movement.entryId!))!;
    expect(entry).toMatchObject({ kind: "contribution", status: "settled", amountCents: 100_000, accountId: checking, counterAccountId: broker });

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

  it("requires a brokerage counter account when pairing", async () => {
    await expect(
      addMovement(repos, U, move({ kind: "contribution", amountCents: "1,00", fromAccountId: checking, brokerageAccountId: checking })),
    ).rejects.toMatchObject({ code: "invalid" });
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

describe("delete", () => {
  it("removes a paired entry with its movement, and protects assets in use", async () => {
    const movement = await addMovement(repos, U, move({ kind: "contribution", amountCents: "1,00", fromAccountId: checking, brokerageAccountId: broker }));
    await expect(deleteAsset(repos, U, cdb)).rejects.toMatchObject({ code: "in_use" });
    await deleteMovement(repos, U, movement.id);
    expect(await repos.entries.getById(U, movement.entryId!)).toBeNull();
    await deleteAsset(repos, U, cdb);
    expect(await repos.assets.list(U)).toHaveLength(0);
  });
});
