import { beforeEach, describe, expect, it } from "vitest";
import { accountInputSchema } from "@/lib/schemas/accounts";
import { assetInputSchema, movementInputSchema } from "@/lib/schemas/assets";
import { entryInputSchema } from "@/lib/schemas/entries";
import { createAccount, updateAccount } from "../accounts";
import { cardsOverview, payStatement } from "../cards";
import { createEntry } from "../entries";
import { cashAtPeriod, netWorthOverview } from "../netWorth";
import { addMovement, createAsset } from "../portfolio";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-10";
let repos: FakeRepositories;
let checking: string;
let savings: string;
let misc: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  const accounts = await repos.accounts.list(U);
  checking = accounts.find((a) => a.name === "Conta Corrente")!.id;
  savings = accounts.find((a) => a.name === "Reserva")!.id;
  misc = (await repos.categories.list(U)).find((c) => c.name === "Outros")!.id;
  await updateAccount(repos, U, checking, accountInputSchema.parse({ name: "Conta Corrente", type: "checking", openingBalanceCents: "1.000,00", openingOn: "2026-10-01" }));
  await updateAccount(repos, U, savings, accountInputSchema.parse({ name: "Reserva", type: "savings", openingBalanceCents: "500,00", openingOn: "2026-10-15" }));
  // The seed opens accounts "today" (the real date); pin the third cash account to the test's timeline.
  const cash = accounts.find((a) => a.name === "Dinheiro")!.id;
  await updateAccount(repos, U, cash, accountInputSchema.parse({ name: "Dinheiro", type: "cash", openingBalanceCents: "0,00", openingOn: "2026-10-20" }));
});

const add = (overrides: Record<string, unknown>) =>
  createEntry(repos, U, entryInputSchema.parse({ kind: "expense", amountCents: "100,00", date: TODAY, description: "x", categoryId: misc, accountId: checking, settled: "on", ...overrides }), { today: TODAY });

describe("derived balances", () => {
  it("starts at the opening balance and follows settled entries, transfers included", async () => {
    await add({ kind: "income", amountCents: "300,00", date: "2026-10-05" });
    await add({ amountCents: "120,00", date: "2026-10-20" });
    await add({ kind: "transfer", counterAccountId: savings, amountCents: "200,00", date: "2026-11-02", categoryId: "" });
    await add({ amountCents: "999,00", date: "2026-11-09", settled: "" }); // planned: not yet

    const overview = await netWorthOverview(repos, U, TODAY, 3);
    const by = Object.fromEntries(overview.balances.map((b) => [b.account.id, b.balanceCents]));
    expect(by[checking]).toBe(100_000 + 30_000 - 12_000 - 20_000);
    expect(by[savings]).toBe(50_000 + 20_000);
    expect(overview.cashCents).toBe(98_000 + 70_000);
  });

  // Acceptance 12, reinterpreted: before any account exists, net worth is null, never 0.
  it("is null before the first account opened and includes investments and card debt after", async () => {
    const cdb = (await createAsset(repos, U, assetInputSchema.parse({ name: "CDB", assetClass: "fixed_income" }))).id;
    await addMovement(repos, U, movementInputSchema.parse({ assetId: cdb, kind: "contribution", date: "2026-10-01", amountCents: "1.000,00" }));
    const card = (await createAccount(repos, U, accountInputSchema.parse({ name: "Card", type: "credit_card", closingDay: "5", dueDay: "15" }))).id;
    await add({ accountId: card, amountCents: "50,00", date: "2026-10-01" }); // Sep 6 – Oct 5 statement, unpaid

    const overview = await netWorthOverview(repos, U, TODAY, 3);
    expect(overview.series.map((p) => p.netWorthCents)).toEqual([null, 100_000 + 50_000 + 100_000 - 5_000, 150_000 + 100_000 - 5_000]);

    const a = (await cardsOverview(repos, U, TODAY)).cards[0];
    await payStatement(repos, U, { statementId: a.past[0].statement.id, fromAccountId: checking, paidOn: "2026-11-05" }, TODAY);
    const after = await netWorthOverview(repos, U, TODAY, 1);
    // The payment left cash and cleared the debt: net worth unchanged, cash lower.
    expect(after.current.netWorthCents).toBe(245_000);
    expect(after.current.cashCents).toBe(145_000);
    expect(after.current.debtCents).toBe(0);
  });

  it("values cash at a past month's end", async () => {
    await add({ kind: "income", amountCents: "300,00", date: "2026-10-05" });
    await add({ amountCents: "50,00", date: "2026-11-03" });
    expect(await cashAtPeriod(repos, U, "2026-10", TODAY)).toBe(100_000 + 30_000 + 50_000);
    expect(await cashAtPeriod(repos, U, "2026-11", TODAY)).toBe(180_000 - 5_000);
    expect(await cashAtPeriod(repos, U, "2026-09", TODAY)).toBeNull();
  });
});
