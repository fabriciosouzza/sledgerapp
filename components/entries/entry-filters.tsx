"use client";

import { useRef } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ENTRY_KINDS } from "@/lib/domain/entries";
import type { Account, Category } from "@/lib/domain/types";

export interface EntryFilterValues {
  month: string;
  kind: string;
  status: string;
  account: string;
  category: string;
  q: string;
}

export function EntryFilters({
  values,
  accounts,
  categories,
}: {
  values: EntryFilterValues;
  accounts: Pick<Account, "id" | "name">[];
  categories: Pick<Category, "id" | "name" | "parentId">[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const hasExtra = values.kind || values.status || values.account || values.category;

  return (
    <form ref={form} method="get" className="space-y-2">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Input type="month" name="month" value={values.month} onChange={submit} aria-label="Month" className="h-11 w-[9.5rem]" />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" name="q" defaultValue={values.q} placeholder="Search" aria-label="Search descriptions" className="h-11 pl-8" />
        </div>
      </div>
      <details open={Boolean(hasExtra)} className="group">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground select-none">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NativeSelect name="kind" value={values.kind} onChange={submit} aria-label="Kind" className="w-full [&>select]:h-11">
            <NativeSelectOption value="">Any kind</NativeSelectOption>
            {ENTRY_KINDS.map((k) => (
              <NativeSelectOption key={k.value} value={k.value}>
                {k.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="status" value={values.status} onChange={submit} aria-label="Status" className="w-full [&>select]:h-11">
            <NativeSelectOption value="">Any status</NativeSelectOption>
            <NativeSelectOption value="planned">Planned</NativeSelectOption>
            <NativeSelectOption value="settled">Settled</NativeSelectOption>
          </NativeSelect>
          <NativeSelect name="account" value={values.account} onChange={submit} aria-label="Account" className="w-full [&>select]:h-11">
            <NativeSelectOption value="">Any account</NativeSelectOption>
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="category" value={values.category} onChange={submit} aria-label="Category" className="w-full [&>select]:h-11">
            <NativeSelectOption value="">Any category</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.parentId ? `· ${c.name}` : c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </details>
      <button type="submit" className="sr-only">
        Apply
      </button>
    </form>
  );
}
