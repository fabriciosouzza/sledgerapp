// Investments (PROMPT.md §5.7): balances are running sums of movements; no
// quotes. A contribution pairs with an `entries` row of kind contribution so
// cash flow and portfolio agree without counting twice.

import { addMonths, periodOf } from "@/lib/domain/dates";
import { balanceByClass, portfolioSeries, summarize, type PortfolioPoint, type PortfolioSummary } from "@/lib/domain/portfolio";
import type { Asset, AssetClass, AssetMovement, IsoDate } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import type { AssetInput, MovementInput, MovementUpdate } from "@/lib/schemas/assets";
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
}

export async function listAssets(repos: Repositories, userId: string): Promise<Asset[]> {
  return repos.assets.list(userId);
}

export async function getAsset(repos: Repositories, userId: string, id: string): Promise<Asset> {
  const asset = await repos.assets.getById(userId, id);
  if (!asset) throw new ServiceError("not_found", "Asset not found.");
  return asset;
}

export async function createAsset(repos: Repositories, userId: string, input: AssetInput): Promise<Asset> {
  return repos.assets.insert(userId, input);
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

export async function portfolioOverview(repos: Repositories, userId: string, today: IsoDate, months = 12): Promise<PortfolioOverview> {
  const [assets, movements] = await Promise.all([repos.assets.list(userId), repos.movements.list(userId)]);
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
  };
}

/** Recorded balance per asset id (running sum of movements). */
export async function assetBalances(repos: Repositories, userId: string): Promise<Record<string, number>> {
  const movements = await repos.movements.list(userId);
  const out: Record<string, number> = {};
  for (const m of movements) out[m.assetId] = (out[m.assetId] ?? 0) + m.amountCents;
  return out;
}

export interface BatchInput {
  kind: "yield" | "market_adjustment";
  date: IsoDate;
  /** `amount`: each value is the movement; `balance`: each value is what the broker shows, the movement is the difference. */
  mode: "amount" | "balance";
  values: { assetId: string; cents: number }[];
}

/** One movement per asset in a single pass — the monthly "record every yield" round. */
export async function recordBatch(repos: Repositories, userId: string, input: BatchInput): Promise<AssetMovement[]> {
  const balances = input.mode === "balance" ? await assetBalances(repos, userId) : {};
  const created: AssetMovement[] = [];
  for (const { assetId, cents } of input.values) {
    const amountCents = input.mode === "balance" ? cents - (balances[assetId] ?? 0) : cents;
    if (amountCents === 0) continue;
    if (amountCents < 0 && input.kind !== "market_adjustment") throw new ServiceError("invalid", "A yield cannot be negative; record a market adjustment instead.");
    const asset = await getAsset(repos, userId, assetId);
    created.push(await repos.movements.insert(userId, { assetId: asset.id, date: input.date, kind: input.kind, amountCents, entryId: null, notes: null }));
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

  let entryId: string | null = null;
  if (input.kind === "contribution" && input.fromAccountId !== null && input.brokerageAccountId !== null) {
    const [from, brokerage] = await Promise.all([
      repos.accounts.getById(userId, input.fromAccountId),
      repos.accounts.getById(userId, input.brokerageAccountId),
    ]);
    if (!from) throw new ServiceError("invalid", "Source account not found.");
    if (!brokerage || brokerage.type !== "brokerage") throw new ServiceError("invalid", "Pick a brokerage account.");
    if (from.id === brokerage.id) throw new ServiceError("invalid", "Source and brokerage must differ.");
    const entry = await repos.entries.insert(userId, {
      date: input.date,
      settledOn: input.date,
      kind: "contribution",
      status: "settled",
      amountCents: input.amountCents,
      description: `Aporte ${asset.name}`,
      categoryId: null,
      accountId: from.id,
      counterAccountId: brokerage.id,
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
    if (input.kind !== "contribution") throw new ServiceError("invalid", "A movement paired with a cash entry stays a contribution; delete it to change that.");
    await repos.entries.update(userId, current.entryId, { amountCents: input.amountCents, date: input.date, settledOn: input.date, notes: input.notes });
  }
  return repos.movements.update(userId, input.id, { kind: input.kind, date: input.date, amountCents: input.amountCents, notes: input.notes });
}

/** Removes the movement and, for a paired contribution, the cash entry it created. */
export async function deleteMovement(repos: Repositories, userId: string, id: string): Promise<void> {
  const movement = await repos.movements.getById(userId, id);
  if (!movement) throw new ServiceError("not_found", "Movement not found.");
  await repos.movements.delete(userId, id);
  if (movement.entryId !== null) await repos.entries.deleteMany(userId, [movement.entryId]);
}
