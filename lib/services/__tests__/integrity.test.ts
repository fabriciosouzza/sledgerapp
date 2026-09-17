// The review of 2026-09-17 (docs/roadmap.md): a statement and its payment
// always agree, card purchases count the day they are made whoever created
// them, a credit statement carries forward, inactive money stays visible, and
// an account never changes nature once it has entries.

import { beforeEach, describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/domain/metrics";
import { accountInputSchema } from "@/lib/schemas/accounts";
import { entryInputSchema, entryUpdateSchema } from "@/lib/schemas/entries";
import { recurrenceInputSchema } from "@/lib/schemas/recurrences";
import { createAccount, updateAccount } from "../accounts";
import { cardsOverview, payStatement, unpayStatement } from "../cards";
import { createEntry, deleteEntry, updateEntry } from "../entries";
import { createRecurrence, generateMonth } from "../recurrences";
import { seedUserIfEmpty } from "../seed";
import { todayOverview } from "../today";
import { fakeRepositories, type FakeRepositories } from "./fakes";

const U = "u1";
const TODAY = "2026-11-10";

let repos: FakeRepositories;
let checking: string;
let food: string;
let card: string;

beforeEach(async () => {
  repos = fakeRepositories();
  await seedUserIfEmpty(repos, U);
  checking = (await repos.accounts.list(U)).find((a) => a.name === "Conta Corrente")!.id;
  await repos.accounts.update(U, checking, { openingBalanceCents: 1_000_000, openingOn: "2026-01-01" });
  food = (await repos.categories.list(U)).find((c) => c.name === "Alimentação")!.id;
  // Closes on the 5th, due on the 15th: October's cycle (06/09 → 05/10) is closed and unpaid on TODAY.
  card = (await createAccount(repos, U, accountInputSchema.parse({ name: "Card", type: "credit_card", closingDay: "5", dueDay: "15" }))).id;
});

const entry = (overrides: Record<string, unknown>) =>
  createEntry(repos, U, entryInputSchema.parse({ kind: "expense", amountCents: "100,00", date: "2026-09-20", description: "Compra", categoryId: food, accountId: card, settled: "on", ...overrides }), { today: TODAY });

async function closedStatement() {
  const { cards } = await cardsOverview(repos, U, TODAY);
  return cards[0].past.find((s) => s.statement.cycleEnd === "2026-10-05")!;
}

describe("a statement and its payment (B1, B5, B9)", () => {
  it("deleting the payment undoes the payment, and the statement is due again", async () => {
    await entry({});
    const closed = await closedStatement();
    const payment = await payStatement(repos, U, { statementId: closed.statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);
    expect((await repos.statements.getById(U, closed.statement.id))!.paidOn).toBe("2026-10-15");

    await deleteEntry(repos, U, payment.id);
    expect(await repos.entries.getById(U, payment.id)).toBeNull();
    expect((await repos.statements.getById(U, closed.statement.id))!.paidOn).toBeNull();
    expect((await cardsOverview(repos, U, TODAY)).toPay.map((s) => s.view.statement.id)).toEqual([closed.statement.id]);
  });

  it("lets the payment change its day, which the statement follows, but not its amount", async () => {
    await entry({});
    const closed = await closedStatement();
    const payment = await payStatement(repos, U, { statementId: closed.statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);
    const base = { id: payment.id, kind: "transfer", description: payment.description, accountId: checking, counterAccountId: card, settled: "on", scope: "this" };
    await updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "100,00", date: "2026-10-17" }));
    expect((await repos.statements.getById(U, closed.statement.id))!.paidOn).toBe("2026-10-17");
    await expect(updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "90,00", date: "2026-10-17" }))).rejects.toMatchObject({ code: "invalid" });
    await expect(updateEntry(repos, U, entryUpdateSchema.parse({ ...base, amountCents: "100,00", date: "2026-10-17", settled: "" }))).rejects.toMatchObject({ code: "invalid" });
  });

  it("points at a statement marked paid with no payment behind it, and at a payment whose statement is not paid", async () => {
    await entry({});
    const closed = await closedStatement();
    const payment = await payStatement(repos, U, { statementId: closed.statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);
    expect((await cardsOverview(repos, U, TODAY)).issues).toEqual([]);
    // Half of the write went missing: the payment row is gone, the flag stayed.
    await repos.entries.deleteMany(U, [payment.id]);
    expect((await cardsOverview(repos, U, TODAY)).issues).toHaveLength(1);
    expect((await cardsOverview(repos, U, TODAY)).issues[0]).toMatch(/marked paid on 2026-10-15, but no payment/);
    // The other half: the flag is gone, the payment stayed.
    await repos.statements.setPaidOn(U, closed.statement.id, null);
    const again = await payStatement(repos, U, { statementId: closed.statement.id, fromAccountId: checking, paidOn: "2026-10-16" }, TODAY);
    await repos.statements.setPaidOn(U, closed.statement.id, null);
    const { issues } = await cardsOverview(repos, U, TODAY);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(new RegExp(`payment of .* on ${again.date} .* not marked paid`));
  });
});

describe("card purchases count the day they are made (B2, B8)", () => {
  it("applies a recurring card charge as settled, so the month's expense is complete before the statement is paid", async () => {
    const streaming = recurrenceInputSchema.parse({ description: "Streaming", kind: "expense", categoryId: food, accountId: card, amountCents: "55,90", dueDay: "8", startsOn: "2026-01-01" });
    const rent = recurrenceInputSchema.parse({ description: "Aluguel", kind: "expense", categoryId: food, accountId: checking, amountCents: "1.800,00", dueDay: "10", startsOn: "2026-01-01" });
    await createRecurrence(repos, U, streaming);
    await createRecurrence(repos, U, rent);
    await generateMonth(repos, U, "2026-09");
    const rows = await repos.entries.list(U, { period: "2026-09" });
    expect(rows.find((e) => e.description === "Streaming")).toMatchObject({ status: "settled", settledOn: "2026-09-08" });
    expect(rows.find((e) => e.description === "Aluguel")).toMatchObject({ status: "planned", settledOn: null });
    const m = computeMetrics({ entries: rows, categories: [], recurrences: [], cashCents: null });
    expect(m.expenseCents).toBe(5_590);
    // Paying and undoing the statement leaves the charge as it was: it was never the payment's to settle.
    const closed = await closedStatement();
    await payStatement(repos, U, { statementId: closed.statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);
    await unpayStatement(repos, U, closed.statement.id);
    expect((await repos.entries.list(U, { period: "2026-09" })).find((e) => e.description === "Streaming")!.status).toBe("settled");
  });

  it("keeps a card purchase settled when the edit form sends no toggle, and an installment part as it was", async () => {
    const { entries } = await entry({});
    const edited = await updateEntry(repos, U, entryUpdateSchema.parse({ id: entries[0].id, kind: "expense", amountCents: "120,00", date: "2026-09-21", description: "Compra", categoryId: food, accountId: card, scope: "this" }));
    expect(edited[0]).toMatchObject({ status: "settled", settledOn: "2026-09-21", amountCents: 12_000 });
    const plan = await entry({ installments: "on", installmentParts: "3", amountCents: "50,00" });
    const [first] = plan.entries;
    expect(first.status).toBe("planned");
    const kept = await updateEntry(repos, U, entryUpdateSchema.parse({ id: first.id, kind: "expense", amountCents: "50,00", date: first.date, description: "Compra", categoryId: food, accountId: card, settled: "on", scope: "this" }));
    expect(kept[0].status).toBe("planned");
  });
});

describe("a statement in credit (B7)", () => {
  it("asks nothing for it, deducts the credit from the next statement, and both settle with one payment", async () => {
    await entry({ date: "2026-08-20", amountCents: "30,00" });
    const misc = (await repos.categories.list(U)).find((c) => c.name === "Outros")!.id;
    await entry({ kind: "income", date: "2026-08-25", amountCents: "80,00", description: "Cashback", categoryId: misc }); // September's statement: −R$ 50
    await entry({ date: "2026-09-20", amountCents: "100,00" }); // October's statement: R$ 100 − 50 credit
    const { cards, toPay } = await cardsOverview(repos, U, TODAY);
    const [october, september] = cards[0].past;
    expect(september).toMatchObject({ totalCents: 0, carriedCents: 0 });
    expect(october).toMatchObject({ totalCents: 5_000, carriedCents: -5_000 });
    expect(toPay.map((s) => s.view.statement.id)).toEqual([october.statement.id]);
    expect(cards[0].debtCents).toBe(5_000);

    const payment = await payStatement(repos, U, { statementId: october.statement.id, fromAccountId: checking, paidOn: "2026-10-15" }, TODAY);
    expect(payment.amountCents).toBe(5_000);
    expect((await repos.statements.getById(U, september.statement.id))!.paidOn).toBe("2026-10-15");
    expect((await cardsOverview(repos, U, TODAY)).cards[0].debtCents).toBe(0);

    await unpayStatement(repos, U, october.statement.id);
    expect((await repos.statements.getById(U, september.statement.id))!.paidOn).toBeNull();
    expect((await cardsOverview(repos, U, TODAY)).cards[0].past.find((s) => s.statement.id === october.statement.id)!.totalCents).toBe(5_000);
  });
});

describe("accounts (B3, B4)", () => {
  it("keeps an inactive account with money in it on Today, so cash on hand and the tiles agree", async () => {
    const savings = (await repos.accounts.list(U)).find((a) => a.name === "Reserva")!.id;
    await repos.accounts.update(U, savings, { openingBalanceCents: 50_000, openingOn: "2026-01-01", isActive: false });
    const cash = (await repos.accounts.list(U)).find((a) => a.name === "Dinheiro")!.id;
    await repos.accounts.update(U, cash, { isActive: false });
    const overview = await todayOverview(repos, U, TODAY);
    expect(overview.cashCents).toBe(1_050_000);
    expect(overview.accounts.map((t) => t.account.name).sort()).toEqual(["Conta Corrente", "Reserva"]);
  });

  it("refuses to turn an account with entries into a card, or a card with entries into cash", async () => {
    await entry({});
    const cardInput = accountInputSchema.parse({ name: "Card", type: "checking" });
    await expect(updateAccount(repos, U, card, cardInput)).rejects.toMatchObject({ code: "invalid" });
    const empty = (await createAccount(repos, U, accountInputSchema.parse({ name: "Nova", type: "checking" }))).id;
    await expect(updateAccount(repos, U, empty, accountInputSchema.parse({ name: "Nova", type: "credit_card", closingDay: "1", dueDay: "10" }))).resolves.toMatchObject({ type: "credit_card" });
  });
});
