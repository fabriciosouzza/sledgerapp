// Entries: the central service (PROMPT.md §5.2–5.4). Both the server actions
// and the route handlers call these; no rule lives anywhere else.

import { isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { allocationProblem, linesFromMovements, movementKindFor, sharesFromLines, splitByShares } from "@/lib/domain/allocation";
import { appliesToKind } from "@/lib/domain/categories";
import { dayOf, periodOf } from "@/lib/domain/dates";
import { needsAllocation, needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { expandInstallments, installmentsInScope, type InstallmentScope } from "@/lib/domain/installments";
import { expandRecurrence } from "@/lib/domain/recurrences";
import type { Account, AllocationLine, Asset, Entry, EntryKind, IsoDate, NewEntry, Recurrence } from "@/lib/domain/types";
import type { EntryFilters, Repositories } from "@/lib/repositories";
import type { EntryInput, EntryUpdate } from "@/lib/schemas/entries";
import { unpayStatement } from "./cards";
import { ServiceError } from "./errors";

/** The transfer that paid a card statement: it exists only as the statement's payment (§5.6). */
function isStatementPayment(entry: Pick<Entry, "kind" | "statementId">): boolean {
  return entry.kind === "transfer" && entry.statementId !== null;
}

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
async function checkRefs(
  repos: Repositories,
  userId: string,
  refs: Refs,
  options: { statementPayment?: boolean } = {},
): Promise<{ account: Account; counter: Account | null }> {
  const account = await repos.accounts.getById(userId, refs.accountId);
  if (!account) throw new ServiceError("invalid", "Account not found.");

  // The cash side of a contribution or redemption is cash (§5.2); the other side is the portfolio.
  if (needsAllocation(refs.kind) && !isCashAccount(account)) {
    throw new ServiceError("invalid", refs.kind === "contribution" ? "A contribution leaves a cash account." : "A redemption reaches a cash account.");
  }

  let counter: Account | null = null;
  if (needsCounterAccount(refs.kind)) {
    if (refs.counterAccountId === null) throw new ServiceError("invalid", "Pick the destination account.");
    counter = await repos.accounts.getById(userId, refs.counterAccountId);
    if (!counter) throw new ServiceError("invalid", "Destination account not found.");
    if (refs.kind === "transfer" && isCreditCard(account)) {
      throw new ServiceError("invalid", "A card statement is paid from a cash account into the card.");
    }
    // Paid by hand, the statement would still count as debt: the card screen's Pay is the only way in.
    if (refs.kind === "transfer" && isCreditCard(counter) && !options.statementPayment) {
      throw new ServiceError("invalid", "Pay a card from Cards → Pay, so the statement is marked as paid.");
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

/** The allocation must add up and point at the user's assets; returns them by id for naming. */
async function checkAllocation(repos: Repositories, userId: string, lines: AllocationLine[], amountCents: number): Promise<Map<string, Asset>> {
  const problem = allocationProblem(lines, amountCents);
  if (problem) throw new ServiceError("invalid", problem);
  const assets = await repos.assets.list(userId);
  const byId = new Map(assets.map((a) => [a.id, a]));
  for (const line of lines) if (!byId.has(line.assetId)) throw new ServiceError("invalid", "Asset not found.");
  return byId;
}

/** "Aporte Tesouro Selic" when it all goes to one asset; plain "Aporte" / "Resgate" otherwise. */
function allocationDescription(kind: EntryKind, lines: AllocationLine[], assets: Map<string, Asset>): string {
  const base = kind === "redemption" ? "Resgate" : "Aporte";
  const single = lines.length === 1 ? assets.get(lines[0].assetId) : undefined;
  return single ? `${base} ${single.name}` : base;
}

/**
 * Records where a settled contribution went: one paired movement per asset
 * (§5.2). Replaces whatever was recorded before, so an edit is a re-allocation.
 */
async function writeAllocation(repos: Repositories, userId: string, entry: Entry, lines: AllocationLine[]): Promise<void> {
  const kind = movementKindFor(entry.kind);
  if (kind === null) return;
  await checkAllocation(repos, userId, lines, entry.amountCents);
  const date = entry.settledOn ?? entry.date;
  // The same assets as before: the movements keep their ids and only follow the numbers.
  const existing = await repos.movements.listByEntry(userId, entry.id);
  const sameAssets = existing.length === lines.length && lines.every((l) => existing.filter((m) => m.assetId === l.assetId).length === 1);
  if (sameAssets) {
    for (const line of lines) {
      const current = existing.find((m) => m.assetId === line.assetId)!;
      if (current.amountCents !== line.amountCents || current.date !== date || current.kind !== kind) {
        await repos.movements.update(userId, current.id, { amountCents: line.amountCents, date, kind });
      }
    }
    return;
  }
  await repos.movements.deleteByEntry(userId, entry.id);
  await repos.movements.insertMany(
    userId,
    lines.map((l) => ({ assetId: l.assetId, date, kind, amountCents: l.amountCents, entryId: entry.id, notes: null })),
  );
}

/** The allocation recorded for an entry, from its paired movements. */
export async function entryAllocation(repos: Repositories, userId: string, entryId: string): Promise<AllocationLine[]> {
  return linesFromMovements(await repos.movements.listByEntry(userId, entryId));
}

export interface AllocationSuggestion {
  assets: Asset[];
  /** Pre-filled lines: the recurrence's default split, or everything into the only asset. */
  lines: AllocationLine[];
}

/** What the allocation sheet opens with when a contribution is settled (§7 Today). */
export async function suggestAllocation(repos: Repositories, userId: string, entryId: string): Promise<AllocationSuggestion> {
  const entry = await getEntry(repos, userId, entryId);
  const assets = (await repos.assets.list(userId)).filter((a) => a.isActive);
  const active = new Set(assets.map((a) => a.id));
  const recorded = linesFromMovements(await repos.movements.listByEntry(userId, entry.id));
  if (recorded.length > 0) return { assets, lines: recorded };
  const recurrence = entry.recurrenceId === null ? null : await repos.recurrences.getById(userId, entry.recurrenceId);
  const shares = (recurrence?.allocations ?? []).filter((s) => active.has(s.assetId));
  if (shares.length > 0) return { assets, lines: splitByShares(entry.amountCents, shares) };
  if (assets.length === 1) return { assets, lines: [{ assetId: assets[0].id, amountCents: entry.amountCents }] };
  return { assets, lines: [] };
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
  const { account, counter } = await checkRefs(repos, userId, { kind, categoryId, accountId: input.accountId, counterAccountId });

  // A card purchase happened when it was made: it is settled at once, and the
  // statement is what gets paid (§5.6). Its installments wait for their
  // statement to be paid (payStatement settles them).
  const onCard = isCreditCard(account) && (kind === "expense" || kind === "income");
  const settled = onCard ? !input.installments : input.settled;
  const settledOn = onCard ? input.date : input.settledOn;

  // A settled contribution says where it went (§5.2); a planned one decides that when it is settled.
  const allocation = needsAllocation(kind) && settled ? (input.allocation ?? []) : null;
  const assets = allocation === null ? new Map<string, Asset>() : await checkAllocation(repos, userId, allocation, input.amountCents);
  const description =
    input.description ?? (counter ? `${account.name} → ${counter.name}` : needsAllocation(kind) ? allocationDescription(kind, allocation ?? [], assets) : account.name);

  // Repeat monthly: a template, plus this month's occurrence so what was
  // just typed shows up. Later months come from "generate month" (§5.5).
  if (input.repeatMonthly) {
    const recurrence = await repos.recurrences.insert(userId, {
      description,
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
      // How this one was split becomes the template's default (§5.5).
      allocations: allocation === null ? [] : sharesFromLines(allocation),
      skippedPeriods: [],
    });
    const first: NewEntry = {
      ...expandRecurrence(recurrence, periodOf(input.date)),
      date: input.date,
      notes: input.notes,
      ...settledFields(settled, settledOn, input.date),
    };
    const entries = await repos.entries.insertMany(userId, [first], { ignoreConflicts: true });
    if (allocation !== null && entries[0]) await writeAllocation(repos, userId, entries[0], allocation);
    return { entries, recurrence };
  }

  if (input.installments) {
    if (kind !== "expense" && kind !== "income") throw new ServiceError("invalid", "Only expenses and income can be split.");
    if (input.installmentParts === null || categoryId === null) throw new ServiceError("invalid", "How many parts?");
    const rows = expandInstallments(
      {
        description,
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
    description,
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
  if (allocation !== null) await writeAllocation(repos, userId, entry, allocation);
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

/**
 * The most used operation in the app (§5.3): one tap, reversible. A
 * contribution or redemption settles with its allocation, which becomes its
 * paired movements (§5.2); nothing is ever left without a destination.
 */
export async function settleEntry(repos: Repositories, userId: string, id: string, settledOn: IsoDate, allocation: AllocationLine[] | null = null): Promise<Entry> {
  const entry = await getEntry(repos, userId, id);
  if (needsAllocation(entry.kind)) {
    const lines = allocation ?? [];
    if (lines.length === 0) throw new ServiceError("invalid", entry.kind === "contribution" ? "Say which assets this contribution goes to." : "Say which assets this redemption comes from.");
    await checkAllocation(repos, userId, lines, entry.amountCents);
    const settled = await repos.entries.update(userId, id, { status: "settled", settledOn });
    await writeAllocation(repos, userId, settled, lines);
    return settled;
  }
  return repos.entries.update(userId, id, { status: "settled", settledOn });
}

/** Back to planned; a contribution's allocation goes with it. */
export async function unsettleEntry(repos: Repositories, userId: string, id: string): Promise<Entry> {
  const entry = await getEntry(repos, userId, id);
  if (needsAllocation(entry.kind)) await repos.movements.deleteByEntry(userId, id);
  return repos.entries.update(userId, id, { status: "planned", settledOn: null });
}

/** Bulk settle is blind, so it never takes contributions: each needs its allocation (§5.2). */
export async function settleEntries(repos: Repositories, userId: string, ids: string[], settledOn: IsoDate): Promise<Entry[]> {
  for (const id of ids) {
    const entry = await getEntry(repos, userId, id);
    if (needsAllocation(entry.kind)) throw new ServiceError("invalid", `Settle "${entry.description}" on its own: it needs to say which assets it goes to.`);
  }
  return repos.entries.updateMany(userId, ids, { status: "settled", settledOn });
}

export async function unsettleEntries(repos: Repositories, userId: string, ids: string[]): Promise<Entry[]> {
  for (const id of ids) await repos.movements.deleteByEntry(userId, id);
  return repos.entries.updateMany(userId, ids, { status: "planned", settledOn: null });
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

  // A statement payment is the statement's total on the day it was paid: only the day and the notes are its own.
  if (isStatementPayment(current)) {
    if (kind !== "transfer" || input.amountCents !== current.amountCents || input.accountId !== current.accountId || counterAccountId !== current.counterAccountId || !input.settled) {
      throw new ServiceError("invalid", "A statement payment keeps its amount and accounts. To change it, undo the payment from Cards and pay again.");
    }
    const paidOn = input.settledOn ?? input.date;
    const updated = await repos.entries.update(userId, current.id, { date: paidOn, settledOn: paidOn, description: input.description ?? current.description, notes: input.notes });
    if (paidOn !== current.settledOn) await repos.statements.setPaidOn(userId, current.statementId!, paidOn);
    return [updated];
  }

  const refs = await checkRefs(repos, userId, { kind, categoryId, accountId: input.accountId, counterAccountId }, { statementPayment: current.statementId !== null });
  // A paired contribution keeps its kind: the movements on the other side are contributions too (§5.2).
  const paired = await repos.movements.listByEntry(userId, current.id);
  if (paired.length > 0 && kind !== current.kind) throw new ServiceError("invalid", "This entry has movements in the portfolio; unsettle it before changing its kind.");

  // Where a settled contribution goes: what was sent, else what is recorded, which must still add up.
  let allocation: AllocationLine[] | null = null;
  if (needsAllocation(kind) && input.settled) {
    allocation = input.allocation ?? linesFromMovements(paired);
    if (allocation.length === 1 && input.allocation === null) allocation = [{ ...allocation[0], amountCents: input.amountCents }];
    await checkAllocation(repos, userId, allocation, input.amountCents);
  }

  const shared: Partial<NewEntry> = {
    kind,
    amountCents: input.amountCents,
    description: input.description ?? (refs.counter ? `${refs.account.name} → ${refs.counter.name}` : refs.account.name),
    categoryId,
    accountId: input.accountId,
    counterAccountId,
    notes: input.notes,
  };
  // A card purchase counts the day it is made and is settled by its statement (§5.6): the form cannot unsettle it,
  // and a settled one follows its date. Installment parts wait for their statement, so they keep whatever they have.
  const onCard = isCreditCard(refs.account) && (kind === "expense" || kind === "income");
  const cardStatus: Pick<NewEntry, "status" | "settledOn"> =
    current.installmentGroupId !== null ? { status: current.status, settledOn: current.settledOn } : { status: "settled", settledOn: input.date };
  const own: Partial<NewEntry> = {
    ...shared,
    date: input.date,
    ...(onCard ? cardStatus : settledFields(input.settled, input.settledOn, input.date)),
  };

  const targets = await scopeOf(repos, userId, current, input.scope);
  const others = targets.filter((e) => e.id !== current.id).map((e) => e.id);
  const updated = await repos.entries.update(userId, current.id, own);
  const rest = await repos.entries.updateMany(userId, others, shared);
  if (allocation !== null) await writeAllocation(repos, userId, updated, allocation);
  else if (paired.length > 0) await repos.movements.deleteByEntry(userId, current.id);
  return [updated, ...rest];
}

export async function deleteEntry(repos: Repositories, userId: string, id: string, scope: InstallmentScope = "this"): Promise<number> {
  const entry = await getEntry(repos, userId, id);
  // Deleting the payment is undoing the payment: the statement opens again and what it settled goes back to planned.
  if (isStatementPayment(entry)) {
    await unpayStatement(repos, userId, entry.statementId!);
    return 1;
  }
  const targets = await scopeOf(repos, userId, entry, scope);
  // The movements on the portfolio side were this entry's other half (§5.2).
  for (const target of targets) await repos.movements.deleteByEntry(userId, target.id);
  return repos.entries.deleteMany(userId, targets.map((e) => e.id));
}
