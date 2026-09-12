import { beforeEach, describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/domain/metrics";
import { accountInputSchema } from "@/lib/schemas/accounts";
import { entryInputSchema } from "@/lib/schemas/entries";
import { createAccount } from "../accounts";
import { cardsOverview, payStatement, unpayStatement } from "../cards";
import { createEntry } from "../entries";
import { seedUserIfEmpty } from "../seed";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-10";

let repos: FakeRepositories;
let checking: string;
let food: string;
let cardA: string;
let cardB: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  checking = (await repos.accounts.list(U)).find((a) => a.name === "Conta Corrente")!.id;
  food = (await repos.categories.list(U)).find((c) => c.name === "Alimentação")!.id;
  cardA = (await createAccount(repos, U, accountInputSchema.parse({ name: "Card A", type: "credit_card", closingDay: "5", dueDay: "15" }))).id;
  cardB = (await createAccount(repos, U, accountInputSchema.parse({ name: "Card B", type: "credit_card", closingDay: "20", dueDay: "28" }))).id;
});

const spend = (accountId: string, date: string, amount: string, description = "Compra") =>
  createEntry(
    repos,
    U,
    entryInputSchema.parse({ kind: "expense", amountCents: amount, date, description, categoryId: food, accountId, settled: "on" }),
    { today: TODAY },
  );

describe("cardsOverview", () => {
  // Acceptance 14: same purchase date, different cycles per card; after closing → next cycle.
  it("resolves the same purchase date into each card's own cycle", async () => {
    await spend(cardA, "2026-11-10", "100,00");
    await spend(cardB, "2026-11-10", "100,00");
    const { cards } = await cardsOverview(repos, U, TODAY);
    const a = cards.find((c) => c.account.id === cardA)!;
    const b = cards.find((c) => c.account.id === cardB)!;
    expect(a.open.statement).toMatchObject({ cycleStart: "2026-11-06", cycleEnd: "2026-12-05", dueDate: "2026-12-15" });
    expect(b.open.statement).toMatchObject({ cycleStart: "2026-10-21", cycleEnd: "2026-11-20", dueDate: "2026-11-28" });
    expect(a.open.totalCents).toBe(10_000);
    expect(b.open.totalCents).toBe(10_000);
  });

  it("puts a purchase after the closing day in the next cycle", async () => {
    await spend(cardB, "2026-11-20", "10,00", "On closing day");
    await spend(cardB, "2026-11-21", "20,00", "Day after");
    const { cards } = await cardsOverview(repos, U, "2026-11-25");
    const b = cards.find((c) => c.account.id === cardB)!;
    expect(b.open.statement.cycleStart).toBe("2026-11-21");
    expect(b.open.totalCents).toBe(2_000);
    expect(b.past[0]).toMatchObject({ totalCents: 1_000, isOpen: false });
  });

  // Acceptance 15: total card debt sums every card and excludes paid statements.
  it("sums debt across cards and drops paid statements", async () => {
    await spend(cardA, "2026-10-01", "300,00"); // A: cycle Sep 6 – Oct 5, closed
    await spend(cardA, "2026-11-10", "50,00"); // A: open
    await spend(cardB, "2026-11-01", "200,00"); // B: open (Oct 21 – Nov 20)
    let overview = await cardsOverview(repos, U, TODAY);
    expect(overview.totalDebtCents).toBe(55_000);

    const a = overview.cards.find((c) => c.account.id === cardA)!;
    const closed = a.past.find((p) => p.totalCents === 30_000)!;
    const payment = await payStatement(repos, U, { statementId: closed.statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);
    expect(payment).toMatchObject({ kind: "transfer", amountCents: 30_000, accountId: checking, counterAccountId: cardA, status: "settled" });

    overview = await cardsOverview(repos, U, TODAY);
    expect(overview.totalDebtCents).toBe(25_000);
    expect(overview.cards.find((c) => c.account.id === cardA)!.debtCents).toBe(5_000);
  });

  // Acceptance 3: paying a statement is not an expense; the purchase is.
  it("keeps the payment out of expense while the purchase stays in", async () => {
    await spend(cardA, "2026-10-01", "300,00");
    const a = (await cardsOverview(repos, U, TODAY)).cards.find((c) => c.account.id === cardA)!;
    await payStatement(repos, U, { statementId: a.past[0].statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);

    const october = await repos.entries.list(U, { period: "2026-10" });
    const m = computeMetrics({ entries: october, categories: [], recurrences: [], cashCents: null });
    expect(m.expenseCents).toBe(30_000);
    expect(october.filter((e) => e.kind === "transfer")).toHaveLength(1);
  });

  it("refuses paying twice, from a card, or an empty statement", async () => {
    await spend(cardA, "2026-10-01", "300,00");
    const a = (await cardsOverview(repos, U, TODAY)).cards.find((c) => c.account.id === cardA)!;
    const id = a.past[0].statement.id;
    await expect(payStatement(repos, U, { statementId: id, fromAccountId: cardB, paidOn: TODAY }, TODAY)).rejects.toMatchObject({ code: "invalid" });
    await expect(payStatement(repos, U, { statementId: a.open.statement.id, fromAccountId: checking, paidOn: TODAY }, TODAY)).rejects.toMatchObject({ code: "invalid" });
    await payStatement(repos, U, { statementId: id, fromAccountId: checking, paidOn: TODAY }, TODAY);
    await expect(payStatement(repos, U, { statementId: id, fromAccountId: checking, paidOn: TODAY }, TODAY)).rejects.toMatchObject({ code: "invalid" });

    await unpayStatement(repos, U, id);
    expect((await repos.entries.list(U, { period: "2026-11" })).filter((e) => e.kind === "transfer")).toHaveLength(0);
    expect((await repos.statements.getById(U, id))!.paidOn).toBeNull();
  });

  it("links card entries to their statement lazily", async () => {
    const [entry] = (await spend(cardA, "2026-11-10", "100,00")).entries;
    expect(entry.statementId).toBeNull();
    const { cards } = await cardsOverview(repos, U, TODAY);
    const open = cards.find((c) => c.account.id === cardA)!.open;
    expect((await repos.entries.getById(U, entry.id))!.statementId).toBe(open.statement.id);
  });
});
