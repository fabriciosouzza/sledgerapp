import { describe, expect, it } from "vitest";
import { entriesCsv } from "@/app/api/export/csv";
import type { Account, Category, Entry } from "@/lib/domain/types";

describe("entriesCsv", () => {
  it("writes names, pt-BR amounts, a BOM and quotes what needs quoting", () => {
    const accounts = [{ id: "a1", name: "Conta Corrente" }, { id: "a2", name: "Nubank" }] as Account[];
    const categories = [
      { id: "c1", name: "Filho", parentId: null },
      { id: "c2", name: "Escola", parentId: "c1" },
    ] as Category[];
    const entries = [
      { date: "2026-09-05", settledOn: "2026-09-05", kind: "expense", status: "settled", amountCents: 123456, description: 'Mensalidade; "set"', categoryId: "c2", accountId: "a2", counterAccountId: null, installmentNo: 4, installmentTotal: 10, notes: null },
      { date: "2026-09-10", settledOn: null, kind: "transfer", status: "planned", amountCents: 50000, description: "Carla → Conjunta", categoryId: null, accountId: "a1", counterAccountId: "a2", installmentNo: null, installmentTotal: null, notes: "#carla" },
    ] as Entry[];
    const csv = entriesCsv(entries, accounts, categories);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("﻿date;settled_on;kind;status;amount;description;category;parent_category;account;counter_account;installment;notes");
    expect(lines[1]).toBe('2026-09-05;2026-09-05;expense;settled;-1234,56;"Mensalidade; ""set""";Escola;Filho;Nubank;;4/10;');
    expect(lines[2]).toBe("2026-09-10;;transfer;planned;500,00;Carla → Conjunta;;;Conta Corrente;Nubank;;#carla");
  });
});
