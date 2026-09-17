import { describe, expect, it } from "vitest";
import { entriesCsv } from "@/app/api/export/csv";
import type { Account, Asset, AssetMovement, Category, Entry } from "@/lib/domain/types";

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
      { id: "e3", date: "2026-09-06", settledOn: "2026-09-06", kind: "contribution", status: "settled", amountCents: 100000, description: "Aporte", categoryId: null, accountId: "a1", counterAccountId: null, installmentNo: null, installmentTotal: null, notes: null },
    ] as Entry[];
    const assets = [{ id: "s1", name: "Tesouro Selic" }, { id: "s2", name: "Bitcoin" }] as Asset[];
    const movements = [
      { entryId: "e3", assetId: "s1", amountCents: 60000, kind: "contribution" },
      { entryId: "e3", assetId: "s2", amountCents: 40000, kind: "contribution" },
      { entryId: null, assetId: "s1", amountCents: 850, kind: "yield" },
    ] as AssetMovement[];
    const csv = entriesCsv(entries, accounts, categories, assets, movements);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("﻿date;settled_on;kind;status;amount;description;category;parent_category;account;counter_account;installment;assets;notes");
    expect(lines[1]).toBe('2026-09-05;2026-09-05;expense;settled;-1234,56;"Mensalidade; ""set""";Escola;Filho;Nubank;;4/10;;');
    expect(lines[2]).toBe("2026-09-10;;transfer;planned;500,00;Carla → Conjunta;;;Conta Corrente;Nubank;;;#carla");
    // Acceptance 16 in the export: a contribution's split travels with it.
    expect(lines[3]).toBe("2026-09-06;2026-09-06;contribution;settled;1000,00;Aporte;;;Conta Corrente;;;Tesouro Selic: 600,00 | Bitcoin: 400,00;");
  });
});
