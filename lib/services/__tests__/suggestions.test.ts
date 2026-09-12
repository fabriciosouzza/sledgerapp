import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/domain/types";
import { suggestionsFrom } from "../suggestions";

const entry = (over: Partial<Entry>): Entry =>
  ({
    id: Math.random().toString(36).slice(2),
    kind: "expense",
    amountCents: 1000,
    date: "2026-09-01",
    description: "x",
    categoryId: "food",
    accountId: "checking",
    counterAccountId: null,
    status: "settled",
    settledOn: "2026-09-01",
    notes: null,
    installmentGroupId: null,
    installmentNo: null,
    installmentTotal: null,
    recurrenceId: null,
    statementId: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as Entry;

describe("suggestionsFrom", () => {
  it("dedupes descriptions per kind case-insensitively, keeping the latest choice, and ranks categories by use", () => {
    const s = suggestionsFrom([
      entry({ description: "Uber", categoryId: "transport", accountId: "nubank" }),
      entry({ description: "uber ", categoryId: "food" }),
      entry({ description: "Mercado" }),
      entry({ description: "Mercado" }),
      entry({ kind: "income", description: "Salário", categoryId: "salary", accountId: "checking" }),
    ]);
    expect(s.descriptions.expense.map((d) => d.description)).toEqual(["Uber", "Mercado"]);
    expect(s.descriptions.expense[0]).toMatchObject({ categoryId: "transport", accountId: "nubank" });
    expect(s.descriptions.income[0].description).toBe("Salário");
    expect(s.topCategories.expense).toEqual(["food", "transport"]);
    expect(s.topCategories.transfer).toEqual([]);
  });
});
