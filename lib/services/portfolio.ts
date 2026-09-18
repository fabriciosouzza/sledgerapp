// Investments (PROMPT.md §5.7): balances are running sums of movements; no
// quotes. A contribution pairs with an `entries` row of kind contribution
// (a redemption with a withdrawal) so cash flow and portfolio agree without
// counting twice.

import { isCashAccount } from "@/lib/domain/accounts";
import { unallocated, type Unallocated } from "@/lib/domain/allocation";
import { addMonths, periodOf, today as todayInSaoPaulo } from "@/lib/domain/dates";
import { balanceByClass, movementSign, portfolioSeries, summarize, type PortfolioPoint, type PortfolioSummary } from "@/lib/domain/portfolio";
import type { Asset, AssetClass, AssetMovement, IsoDate } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import type { AssetInput, MovementInput, MovementUpdate, NewAssetInput } from "@/lib/schemas/assets";
import { ServiceError } from "./errors";

export interface AssetLine {
  asset: Asset;
  summary: PortfolioSummary;
  lastMovement: IsoDate | null;
}

export interface PortfolioOverview {
  total: PortfolioSummary;
  byClass: { assetClass: AssetClass; balanceCents: number }[];
  assets: AssetLine[];
  series: PortfolioPoint[];
  /** Settled contributions and redemptions whose paired movements do not add up: money with no asset behind it (§5.2). */
  unallocated: Unallocated[];
}

export async function listAssets(repos: Repositories, userId: string): Promise<Asset[]> {
  return repos.assets.list(userId);
}

export async function getAsset(repos: Repositories, userId: string, id: string): Promise<Asset> {
  const asset = await repos.assets.getById(userId, id);
  if (!asset) throw new ServiceError("not_found", "Asset not found.");
  return asset;
}

export async function createAsset(repos: Repositories, userId: string, input: AssetInput | NewAssetInput): Promise<Asset> {
  const { openingContributedCents = null, openingBalanceCents = null, openingOn = null, ...fields } = input as NewAssetInput;
  const asset = await repos.assets.insert(userId, fields);
  // Starting from a spreadsheet: what was put in becomes a contribution with no
  // cash entry (the money left the bank long ago), and the rest is market movement.
  const contributed = openingContributedCents ?? openingBalanceCents ?? 0;
  const balance = openingBalanceCents ?? contributed;
  const date = openingOn ?? todayInSaoPaulo();
  if (contributed > 0) {
    await repos.movements.insert(userId, { assetId: asset.id, date, kind: "contribution", amountCents: contributed, entryId: null, notes: "Opening balance" });
  }
  if (balance - contributed !== 0) {
    await repos.movements.insert(userId, { assetId: asset.id, date, kind: "market_adjustment", amountCents: balance - contributed, entryId: null, notes: "Opening balance" });
  }
  return asset;
}

export async function updateAsset(repos: Repositories, userId: string, id: string, input: AssetInput): Promise<Asset> {
  await getAsset(repos, userId, id);
  return repos.assets.update(userId, id, input);
}

export async function deleteAsset(repos: Repositories, userId: string, id: string): Promise<void> {
  await getAsset(repos, userId, id);
  const movements = await repos.movements.listByAsset(userId, id);
  if (movements.length > 0) throw new ServiceError("in_use", "This asset has movements. Deactivate it instead.");
  await repos.assets.delete(userId, id);
}

/** Every settled contribution and redemption, from the day the oldest cash account opened (nothing settles before that). */
async function cashSideEntries(repos: Repositories, userId: string, until: IsoDate) {
  const accounts = (await repos.accounts.list(userId)).filter(isCashAccount);
  if (accounts.length === 0) return [];
  const from = accounts.reduce((min, a) => (a.openingOn < min ? a.openingOn : min), accounts[0].openingOn);
  return repos.entries.list(userId, { kinds: ["contribution", "redemption"], status: "settled", settledFrom: from, settledTo: until });
}

export async function portfolioOverview(repos: Repositories, userId: string, today: IsoDate, months = 12): Promise<PortfolioOverview> {
  const [assets, movements, cashSide] = await Promise.all([repos.assets.list(userId), repos.movements.list(userId), cashSideEntries(repos, userId, today)]);
  const byAsset = new Map<string, AssetMovement[]>();
  for (const m of movements) byAsset.set(m.assetId, [...(byAsset.get(m.assetId) ?? []), m]);

  const lines: AssetLine[] = assets
    .map((asset) => {
      const own = byAsset.get(asset.id) ?? [];
      return { asset, summary: summarize(own), lastMovement: own.reduce<IsoDate | null>((max, m) => (max === null || m.date > max ? m.date : max), null) };
    })
    .filter((line) => line.asset.isActive || line.summary.balanceCents !== 0)
    .sort((a, b) => b.summary.balanceCents - a.summary.balanceCents);

  const period = periodOf(today);
  return {
    total: summarize(movements),
    byClass: [...balanceByClass(assets, movements)]
      .map(([assetClass, balanceCents]) => ({ assetClass, balanceCents }))
      .filter((c) => c.balanceCents > 0)
      .sort((a, b) => b.balanceCents - a.balanceCents),
    assets: lines,
    series: portfolioSeries(movements, addMonths(period, -(months - 1)), period),
    unallocated: unallocated(cashSide, movements).sort((a, b) => (a.entry.date < b.entry.date ? -1 : 1)),
  };
}

/** Recorded balance per asset id (running sum of movements, each with its sign). */
export async function assetBalances(repos: Repositories, userId: string): Promise<Record<string, number>> {
  const movements = await repos.movements.list(userId);
  const out: Record<string, number> = {};
  for (const m of movements) out[m.assetId] = (out[m.assetId] ?? 0) + movementSign(m.kind) * m.amountCents;
  return out;
}

export interface BatchInput {
  /** Fallback for a line that names no kind of its own. */
  kind: "yield" | "market_adjustment";
  date: IsoDate;
  /** `amount`: each value is the movement; `balance`: each value is what the broker shows, the movement is the difference. */
  mode: "amount" | "balance";
  /** One line per asset; a fixed-income line yields, a priced one is adjusted — each says which (§5.7). */
  values: { assetId: string; cents: number; kind?: "yield" | "market_adjustment" }[];
}

/** One movement per asset in a single pass — the monthly "record every yield" round. */
export async function recordBatch(repos: Repositories, userId: string, input: BatchInput): Promise<AssetMovement[]> {
  const balances = input.mode === "balance" ? await assetBalances(repos, userId) : {};
  const created: AssetMovement[] = [];
  for (const { assetId, cents, kind: lineKind } of input.values) {
    const amountCents = input.mode === "balance" ? cents - (balances[assetId] ?? 0) : cents;
    if (amountCents === 0) continue;
    // A yield cannot be negative; a line that went down is market movement.
    const kind = amountCents < 0 ? "market_adjustment" : (lineKind ?? input.kind);
    const asset = await getAsset(repos, userId, assetId);
    created.push(await repos.movements.insert(userId, { assetId: asset.id, date: input.date, kind, amountCents, entryId: null, notes: null }));
  }
  return created;
}

export interface AssetDetail {
  asset: Asset;
  summary: PortfolioSummary;
  movements: AssetMovement[];
}

export async function assetDetail(repos: Repositories, userId: string, id: string): Promise<AssetDetail> {
  const asset = await getAsset(repos, userId, id);
  const movements = await repos.movements.listByAsset(userId, id);
  return { asset, summary: summarize(movements), movements };
}

export async function addMovement(repos: Repositories, userId: string, input: MovementInput): Promise<AssetMovement> {
  const asset = await getAsset(repos, userId, input.assetId);

  // A contribution pairs with a contribution entry (cash → this asset); a
  // withdrawal with a redemption (this asset → cash). Both keep the cash side
  // and the portfolio in step without counting twice (§5.2).
  let entryId: string | null = null;
  const pairs = (input.kind === "contribution" || input.kind === "withdrawal") && input.cashAccountId !== null;
  if (pairs) {
    const cash = await repos.accounts.getById(userId, input.cashAccountId!);
    if (!cash) throw new ServiceError("invalid", "Cash account not found.");
    if (!isCashAccount(cash)) throw new ServiceError("invalid", "Pick a cash account, not a card.");
    const outgoing = input.kind === "contribution";
    const entry = await repos.entries.insert(userId, {
      date: input.date,
      settledOn: input.date,
      kind: outgoing ? "contribution" : "redemption",
      status: "settled",
      amountCents: input.amountCents,
      description: outgoing ? `Aporte ${asset.name}` : `Resgate ${asset.name}`,
      categoryId: null,
      accountId: cash.id,
      counterAccountId: null,
      notes: input.notes,
      source: "manual",
      recurrenceId: null,
      period: null,
      installmentGroupId: null,
      installmentNo: null,
      installmentTotal: null,
      statementId: null,
    });
    entryId = entry.id;
  }

  return repos.movements.insert(userId, {
    assetId: asset.id,
    date: input.date,
    kind: input.kind,
    amountCents: input.amountCents,
    entryId,
    notes: input.notes,
  });
}

export async function getMovement(repos: Repositories, userId: string, id: string): Promise<AssetMovement> {
  const movement = await repos.movements.getById(userId, id);
  if (!movement) throw new ServiceError("not_found", "Movement not found.");
  return movement;
}

/** Edits what happened; a paired cash entry follows the amount and the date. */
export async function updateMovement(repos: Repositories, userId: string, input: MovementUpdate): Promise<AssetMovement> {
  const current = await getMovement(repos, userId, input.id);
  if (current.entryId !== null) {
    if (input.kind !== current.kind) throw new ServiceError("invalid", "A movement paired with a cash entry keeps its kind; delete it to change that.");
    // One entry split across assets: its amount is the sum of its parts, so a part is re-allocated from the entry, not here.
    const siblings = await repos.movements.listByEntry(userId, current.entryId);
    if (siblings.length > 1 && input.amountCents !== current.amountCents) {
      throw new ServiceError("invalid", "This is one part of an investment split across assets; change the split from the entry.");
    }
    await repos.entries.update(userId, current.entryId, { amountCents: input.amountCents, date: input.date, settledOn: input.date, notes: input.notes });
  }
  return repos.movements.update(userId, input.id, { kind: input.kind, date: input.date, amountCents: input.amountCents, notes: input.notes });
}

/** Removes the movement and, for a paired contribution, the cash entry it created. */
export async function deleteMovement(repos: Repositories, userId: string, id: string): Promise<void> {
  const movement = await repos.movements.getById(userId, id);
  if (!movement) throw new ServiceError("not_found", "Movement not found.");
  if (movement.entryId !== null) {
    const siblings = await repos.movements.listByEntry(userId, movement.entryId);
    if (siblings.length > 1) throw new ServiceError("invalid", "This is one part of an investment split across assets; change the split from the entry.");
  }
  await repos.movements.delete(userId, id);
  if (movement.entryId !== null) await repos.entries.deleteMany(userId, [movement.entryId]);
}
