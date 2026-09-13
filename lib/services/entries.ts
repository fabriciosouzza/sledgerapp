// Entries: the central service (PROMPT.md §5.2–5.4). Both the server actions
// and the route handlers call these; no rule lives anywhere else.

import { isCreditCard } from "@/lib/domain/accounts";
import { appliesToKind } from "@/lib/domain/categories";
import { dayOf, periodOf } from "@/lib/domain/dates";
import { needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { expandInstallments, installmentsInScope, type InstallmentScope } from "@/lib/domain/installments";
import { expandRecurrence } from "@/lib/domain/recurrences";
import type { Account, Entry, EntryKind, IsoDate, NewEntry, Recurrence } from "@/lib/domain/types";
import type { EntryFilters, Repositories } from "@/lib/repositories";
import type { EntryInput, EntryUpdate } from "@/lib/schemas/entries";
import { ServiceError } from "./errors";

export interface CreateEntryOptions {
  today: IsoDate;
  /** Injected so tests get stable ids. */
  newId?: () => string;
}

export interface CreateEntryResult {
  entries: Entry[];
  recurrence: Recurrence | null;
}

interface Refs {
  kind: EntryKind;
  categoryId: string | null;
  accountId: string;
  counterAccountId: string | null;
}

/** Every referenced row must exist, belong to the user and fit the kind. */
async function checkRefs(repos: Repositories, userId: string, refs: Refs): Promise<{ account: Account; counter: Account | null }> {
  const account = await repos.accounts.getById(userId, refs.accountId);
  if (!account) throw new ServiceError("invalid", "Account not found.");

  let counter: Account | null = null;
  if (needsCounterAccount(refs.kind)) {
    if (refs.counterAccountId === null) throw new ServiceError("invalid", "Pick the destination account.");
    counter = await repos.accounts.getById(userId, refs.counterAccountId);
    if (!counter) throw new ServiceError("invalid", "Destination account not found.");
    if (refs.kind === "contribution" && counter.type !== "brokerage") {
      throw new ServiceError("invalid", "A contribution goes to a brokerage account.");
    }
    if (refs.kind === "transfer" && isCreditCard(account)) {
      throw new ServiceError("invalid", "A card statement is paid from a cash account into the card.");
    }
  }

  if (needsCategory(refs.kind)) {
    if (refs.categoryId === null) throw new ServiceError("invalid", "Pick a category.");
    const category = await repos.categories.getById(userId, refs.categoryId);
    if (!category) throw new ServiceError("invalid", "Category not found.");
    if (!appliesToKind(category, refs.kind)) {
      throw new ServiceError("invalid", `"${category.name}" does not apply to ${refs.kind}.`);
    }
  }

  return { account, counter };
}

function settledFields(settled: boolean, settledOn: IsoDate | null, date: IsoDate): Pick<NewEntry, "status" | "settledOn"> {
  return settled ? { status: "settled", settledOn: settledOn ?? date } : { status: "planned", settledOn: null };
}

export async function createEntry(
  repos: Repositories,
  userId: string,
  input: EntryInput,
  options: CreateEntryOptions,
): Promise<CreateEntryResult> {
  const kind = input.kind;
  const categoryId = needsCategory(kind) ? input.categoryId : null;
  const counterAccountId = needsCounterAccount(kind) ? input.counterAccountId : null;
  const { account } = await checkRefs(repos, userId, { kind, categoryId, accountId: input.accountId, counterAccountId });

  // A card purchase happened when it was made: it is settled at once, and the
  // statement is what gets paid (§5.6). Its installments wait for their
  // statement to be paid (payStatement settles them).
  const onCard = isCreditCard(account) && (kind === "expense" || kind === "income");
  const settled = onCard ? !input.installments : input.settled;
  const settledOn = onCard ? input.date : input.settledOn;

  // Repeat monthly: a template, plus this month's occurrence so what was
  // just typed shows up. Later months come from "generate month" (§5.5).
  if (input.repeatMonthly) {
    const recurrence = await repos.recurrences.insert(userId, {
      description: input.description,
      kind,
      categoryId,
      accountId: input.accountId,
      counterAccountId,
      amountCents: input.amountCents,
      dueDay: dayOf(input.date),
      startsOn: input.date,
      endsOn: null,
      isVariable: input.variable,
      isActive: true,
    });
    const first: NewEntry = {
      ...expandRecurrence(recurrence, periodOf(input.date)),
      date: input.date,
      notes: input.notes,
      ...settledFields(settled, settledOn, input.date),
    };
    const entries = await repos.entries.insertMany(userId, [first], { ignoreConflicts: true });
    return { entries, recurrence };
  }

  if (input.installments) {
    if (kind !== "expense" && kind !== "income") throw new ServiceError("invalid", "Only expenses and income can be split.");
    if (input.installmentParts === null || categoryId === null) throw new ServiceError("invalid", "How many parts?");
    const rows = expandInstallments(
      {
        description: input.description,
        kind,
        amountCents: input.amountCents,
        parts: input.installmentParts,
        firstNo: input.installmentFirstNo ?? 1,
        firstDate: input.date,
        categoryId,
        accountId: input.accountId,
        notes: input.notes,
        firstSettledOn: !onCard && input.settled ? (input.settledOn ?? input.date) : null,
      },
      (options.newId ?? (() => crypto.randomUUID()))(),
    );
    return { entries: await repos.entries.insertMany(userId, rows), recurrence: null };
  }

  const entry = await repos.entries.insert(userId, {
    date: input.date,
    kind,
    amountCents: input.amountCents,
    description: input.description,
    categoryId,
    accountId: input.accountId,
    counterAccountId,
    notes: input.notes,
    source: "manual",
    recurrenceId: null,
    period: null,
    installmentGroupId: null,
    installmentNo: null,
    installmentTotal: null,
    statementId: null,
    ...settledFields(settled, settledOn, input.date),
  });
  return { entries: [entry], recurrence: null };
}

export async function getEntry(repos: Repositories, userId: string, id: string): Promise<Entry> {
  const entry = await repos.entries.getById(userId, id);
  if (!entry) throw new ServiceError("not_found", "Entry not found.");
  return entry;
}

export async function listEntries(repos: Repositories, userId: string, filters: EntryFilters): Promise<Entry[]> {
  return repos.entries.list(userId, filters);
}

/** The most used operation in the app (§5.3): one tap, reversible. */
export async function settleEntry(repos: Repositories, userId: string, id: string, settledOn: IsoDate): Promise<Entry> {
  await getEntry(repos, userId, id);
  return repos.entries.update(userId, id, { status: "settled", settledOn });
}

export async function unsettleEntry(repos: Repositories, userId: string, id: string): Promise<Entry> {
  await getEntry(repos, userId, id);
  return repos.entries.update(userId, id, { status: "planned", settledOn: null });
}

export async function settleEntries(repos: Repositories, userId: string, ids: string[], settledOn: IsoDate): Promise<Entry[]> {
  return repos.entries.updateMany(userId, ids, { status: "settled", settledOn });
}

/** Parts of the group an edit or delete touches; a lone entry is its own group. */
async function scopeOf(repos: Repositories, userId: string, entry: Entry, scope: InstallmentScope): Promise<Entry[]> {
  if (entry.installmentGroupId === null || entry.installmentNo === null) return [entry];
  const group = await repos.entries.list(userId, { installmentGroupId: entry.installmentGroupId });
  return installmentsInScope(group, entry.installmentNo, scope);
}

export async function updateEntry(repos: Repositories, userId: string, input: EntryUpdate): Promise<Entry[]> {
  const current = await getEntry(repos, userId, input.id);
  const kind = input.kind;
  const categoryId = needsCategory(kind) ? input.categoryId : null;
  const counterAccountId = needsCounterAccount(kind) ? input.counterAccountId : null;
  await checkRefs(repos, userId, { kind, categoryId, accountId: input.accountId, counterAccountId });

  const shared: Partial<NewEntry> = {
    kind,
    amountCents: input.amountCents,
    description: input.description,
    categoryId,
    accountId: input.accountId,
    counterAccountId,
    notes: input.notes,
  };
  const own: Partial<NewEntry> = {
    ...shared,
    date: input.date,
    ...settledFields(input.settled, input.settledOn, input.date),
  };

  const targets = await scopeOf(repos, userId, current, input.scope);
  const others = targets.filter((e) => e.id !== current.id).map((e) => e.id);
  const updated = await repos.entries.update(userId, current.id, own);
  const rest = await repos.entries.updateMany(userId, others, shared);
  // A contribution paired with a portfolio movement (§5.7): the two must agree.
  const paired = await repos.movements.getByEntry(userId, current.id);
  if (paired) {
    if (kind !== current.kind) throw new ServiceError("invalid", "This entry is paired with a portfolio movement; change it from the portfolio.");
    await repos.movements.update(userId, paired.id, { amountCents: input.amountCents, date: input.date, notes: input.notes });
  }
  return [updated, ...rest];
}

export async function deleteEntry(repos: Repositories, userId: string, id: string, scope: InstallmentScope = "this"): Promise<number> {
  const entry = await getEntry(repos, userId, id);
  const targets = await scopeOf(repos, userId, entry, scope);
  for (const target of targets) {
    const paired = await repos.movements.getByEntry(userId, target.id);
    if (paired) await repos.movements.delete(userId, paired.id);
  }
  return repos.entries.deleteMany(userId, targets.map((e) => e.id));
}
