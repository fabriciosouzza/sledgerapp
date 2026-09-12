import { beforeEach, describe, expect, it } from "vitest";
import { accountInputSchema } from "@/lib/schemas/accounts";
import { assetInputSchema, movementInputSchema } from "@/lib/schemas/assets";
import { createAccount } from "../accounts";
import { netWorthOverview, saveSnapshot } from "../netWorth";
import { addMovement, createAsset } from "../portfolio";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-10";
let repos: FakeRepositories;
let checking: string;
let broker: string;
let card: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  const accounts = await repos.accounts.list(U);
  checking = accounts.find((a) => a.name === "Conta Corrente")!.id;
  broker = accounts.find((a) => a.name === "Corretora")!.id;
  card = (await createAccount(repos, U, accountInputSchema.parse({ name: "Card", type: "credit_card", closingDay: "5", dueDay: "15" }))).id;
});

describe("netWorth", () => {
  // Acceptance 12: a month without a snapshot returns null, not 0.
  it("is null without a snapshot even when investments exist", async () => {
    const cdb = (await createAsset(repos, U, assetInputSchema.parse({ name: "CDB", assetClass: "fixed_income" }))).id;
    await addMovement(repos, U, movementInputSchema.parse({ assetId: cdb, kind: "contribution", date: "2026-10-01", amountCents: "1.000,00" }));

    const overview = await netWorthOverview(repos, U, TODAY, undefined, 3);
    expect(overview.series.map((p) => p.netWorthCents)).toEqual([null, null, null]);
    expect(overview.series[2].investmentsCents).toBe(100_000);
    expect(overview.current?.netWorthCents).toBeNull();
    expect(overview.cashCents).toBeNull();
    expect(overview.form.hasSnapshot).toBe(false);
  });

  it("is cash + investments − debt once a snapshot exists", async () => {
    const cdb = (await createAsset(repos, U, assetInputSchema.parse({ name: "CDB", assetClass: "fixed_income" }))).id;
    await addMovement(repos, U, movementInputSchema.parse({ assetId: cdb, kind: "contribution", date: "2026-10-01", amountCents: "1.000,00" }));
    await saveSnapshot(repos, U, {
      period: "2026-11",
      balances: [
        { accountId: checking, amountCents: 500_000 },
        { accountId: card, amountCents: 120_000 },
      ],
    });

    const overview = await netWorthOverview(repos, U, TODAY, undefined, 2);
    expect(overview.series.map((p) => p.netWorthCents)).toEqual([null, 500_000 + 100_000 - 120_000]);
    expect(overview.cashCents).toBe(500_000);
    expect(overview.form.hasSnapshot).toBe(true);
    expect(overview.form.lines.map((l) => [l.account.id, l.kind, l.amountCents])).toEqual(
      expect.arrayContaining([
        [checking, "cash", 500_000],
        [card, "debt", 120_000],
      ]),
    );
    // Brokerage accounts are never listed: investments are derived (§5.9).
    expect(overview.form.lines.some((l) => l.account.id === broker)).toBe(false);
  });

  it("replaces a month's values and refuses brokerage or negative balances", async () => {
    await saveSnapshot(repos, U, { period: "2026-11", balances: [{ accountId: checking, amountCents: 100 }] });
    await saveSnapshot(repos, U, { period: "2026-11", balances: [{ accountId: checking, amountCents: 200 }] });
    expect(await repos.snapshots.listByPeriod(U, "2026-11")).toHaveLength(1);
    expect((await repos.snapshots.listByPeriod(U, "2026-11"))[0].amountCents).toBe(200);

    await expect(saveSnapshot(repos, U, { period: "2026-11", balances: [{ accountId: broker, amountCents: 1 }] })).rejects.toMatchObject({ code: "invalid" });
    await expect(saveSnapshot(repos, U, { period: "2026-11", balances: [{ accountId: checking, amountCents: -1 }] })).rejects.toMatchObject({ code: "invalid" });
  });
});
