"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Field } from "@/components/forms/field";
import { formatDate, formatDayMonth } from "@/lib/domain/dates";
import { MonthPicker } from "@/components/month/month-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/responsive-sheet";
import type { Account, Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { accountLabel } from "@/lib/domain/accounts";

export interface EntryFilterValues {
  month: string;
  kind: string;
  status: string;
  account: string;
  category: string;
  q: string;
}

const TABS = [
  { value: "", label: "All" },
  { value: "expense", label: "Spending" },
  { value: "income", label: "Income" },
  { value: "moves", label: "Moves" },
] as const;

/** Month + search on top, kind as tabs, the rest behind a sheet (DESIGN.md §3, §11). The form submits with GET. */
export function EntryFilters({
  values,
  accounts,
  categories,
  range = null,
}: {
  values: EntryFilterValues;
  /** When set, the list covers this range instead of `values.month`. */
  range?: { from: string; to: string } | null;
  accounts: Pick<Account, "id" | "name" | "type">[];
  categories: Pick<Category, "id" | "name" | "parentId">[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const [month, setMonth] = useState(values.month);
  const [kind, setKind] = useState(values.kind);
  const [status, setStatus] = useState(values.status);
  const [account, setAccount] = useState(values.account);
  const [category, setCategory] = useState(values.category);
  const [open, setOpen] = useState(false);

  // Draft values inside the sheet; committed on Apply.
  const [draft, setDraft] = useState({ status, account, category });
  const extraCount = [status, account, category].filter(Boolean).length;

  function submitSoon() {
    // Let React flush the hidden inputs before the form serialises.
    setTimeout(() => form.current?.requestSubmit(), 0);
  }

  function apply() {
    setStatus(draft.status);
    setAccount(draft.account);
    setCategory(draft.category);
    setOpen(false);
    submitSoon();
  }

  function clear() {
    setDraft({ status: "", account: "", category: "" });
    setStatus("");
    setAccount("");
    setCategory("");
    setOpen(false);
    submitSoon();
  }

  return (
    <form ref={form} method="get" className="@container space-y-3">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="account" value={account} />
      <input type="hidden" name="category" value={category} />

      {/* Side by side while the form is wide in rem; stacked under large text. */}
      <div className="grid grid-cols-1 gap-2 @min-[20rem]:grid-cols-[10.5rem_1fr]">
        {range ? (
          <Link href={`/entries?month=${month}${kind ? `&kind=${kind}` : ""}${category ? `&category=${category}` : ""}`} className="flex h-11 items-center justify-between gap-2 rounded-lg border border-input px-2.5 text-xs tabular-nums hover:bg-muted" title={`${formatDate(range.from)} → ${formatDate(range.to)} · back to one month`}>
            <span className="truncate">
              {formatDayMonth(range.from)} → {formatDayMonth(range.to)}
              <span className="text-muted-foreground"> · {range.to.slice(0, 4)}</span>
            </span>
            <X className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ) : (
          <MonthPicker
            period={month}
            compact
            onChange={(p) => {
              setMonth(p);
              submitSoon();
            }}
          />
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" name="q" defaultValue={values.q} placeholder="Search" aria-label="Search descriptions" className="h-11 pl-8" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Kind" className="flex flex-1 gap-1 rounded-lg bg-muted p-1 @max-[20rem]:basis-full @max-[20rem]:flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={kind === tab.value}
              onClick={() => {
                setKind(tab.value);
                submitSoon();
              }}
              className={cn(
                "h-11 flex-1 rounded-md px-1 text-xs @max-[20rem]:flex-auto @max-[20rem]:px-2 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:text-sm",
                kind === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Sheet
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setDraft({ status, account, category });
          }}
        >
          <SheetTrigger render={<Button type="button" variant={extraCount > 0 ? "secondary" : "outline"} className="h-13 shrink-0" aria-label="More filters" />}>
            <SlidersHorizontal data-icon="inline-start" aria-hidden />
            {extraCount > 0 ? extraCount : "Filters"}
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <SheetBody className="space-y-4 pt-4">
              <Field label="Status" htmlFor="f-status">
                <NativeSelect id="f-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="w-full [&>select]:h-11">
                  <NativeSelectOption value="">Any status</NativeSelectOption>
                  <NativeSelectOption value="planned">Planned</NativeSelectOption>
                  <NativeSelectOption value="settled">Settled</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field label="Account" htmlFor="f-account">
                <NativeSelect id="f-account" value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} className="w-full [&>select]:h-11">
                  <NativeSelectOption value="">Any account</NativeSelectOption>
                  {accounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Category" htmlFor="f-category">
                <NativeSelect id="f-category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="w-full [&>select]:h-11">
                  <NativeSelectOption value="">Any category</NativeSelectOption>
                  {categories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.parentId ? `· ${c.name}` : c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </SheetBody>
            <SheetFooter>
              <Button type="button" className="h-11 md:h-8" onClick={apply}>
                Apply
              </Button>
              <Button type="button" variant="outline" className="h-11 md:h-8" onClick={clear}>
                Clear
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      <button type="submit" className="sr-only">
        Apply
      </button>
    </form>
  );
}
