// Net worth (PROMPT.md §5.9): a manual monthly snapshot of cash and debt
// accounts plus investments derived from movements. A month without a
// snapshot is null, never zero.

import { isCashAccount, isCreditCard } from "@/lib/domain/accounts";
import { addMonths, periodOf, periodRange, periodStart } from "@/lib/domain/dates";
import { latestCash, netWorthFor, netWorthSeries, type NetWorthPoint } from "@/lib/domain/netWorth";
import { investmentsAt } from "@/lib/domain/portfolio";
import type { Account, BalanceKind, BalanceSnapshot, IsoDate, Period } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";
import { ServiceError } from "./errors";

export interface SnapshotLine {
  account: Account;
  kind: BalanceKind;
  amountCents: number | null;
}

export interface NetWorthOverview {
  series: NetWorthPoint[];
  current: NetWorthPoint | null;
  /** Latest known cash at `today`'s period, for runway; `null` with no snapshot yet. */
  cashCents: number | null;
  /** What the form lists for `period`: every active cash or card account with its saved value, if any. */
  form: { period: Period; lines: SnapshotLine[]; hasSnapshot: boolean };
}

function kindOf(account: Account): BalanceKind | null {
  if (isCreditCard(account)) return "debt";
  if (isCashAccount(account)) return "cash";
  return null; // brokerage: derived from movements, never snapshotted (§5.9)
}

export async function netWorthOverview(repos: Repositories, userId: string, today: IsoDate, period?: Period, months = 12): Promise<NetWorthOverview> {
  const current = periodOf(today);
  const formPeriod = period ?? current;
  const from = addMonths(current, -(months - 1));
  const to = formPeriod > current ? formPeriod : current;

  const [accounts, snapshots, movements] = await Promise.all([
    repos.accounts.list(userId),
    repos.snapshots.listBetween(userId, from, to),
    repos.movements.list(userId),
  ]);

  const series = netWorthSeries(periodRange(from, current), snapshots, (p) => investmentsAt(movements, p));
  const forPeriod = snapshots.filter((s) => periodOf(s.period) === formPeriod);
  const byAccount = new Map(forPeriod.map((s) => [s.accountId, s]));
  const lines = accounts
    .map((account) => ({ account, kind: kindOf(account) }))
    .filter((l): l is { account: Account; kind: BalanceKind } => l.kind !== null && (l.account.isActive || byAccount.has(l.account.id)))
    .map(({ account, kind }) => ({ account, kind, amountCents: byAccount.get(account.id)?.amountCents ?? null }));

  return {
    series,
    current: series[series.length - 1] ?? null,
    cashCents: latestCash(snapshots, current),
    form: { period: formPeriod, lines, hasSnapshot: forPeriod.length > 0 },
  };
}

export interface SnapshotInput {
  period: Period;
  balances: { accountId: string; amountCents: number }[];
}

/** Replaces the month's snapshot with every account at once (§7 /net-worth). */
export async function saveSnapshot(repos: Repositories, userId: string, input: SnapshotInput): Promise<BalanceSnapshot[]> {
  const accounts = await repos.accounts.list(userId);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = input.balances.map(({ accountId, amountCents }) => {
    const account = byId.get(accountId);
    if (!account) throw new ServiceError("invalid", "Account not found.");
    const kind = kindOf(account);
    if (kind === null) throw new ServiceError("invalid", `${account.name} is a brokerage: its balance comes from movements.`);
    if (!Number.isInteger(amountCents) || amountCents < 0) throw new ServiceError("invalid", "Balances are zero or positive; a card's balance is its debt.");
    return { period: periodStart(input.period), accountId, kind, amountCents };
  });
  if (rows.length === 0) throw new ServiceError("invalid", "Nothing to save.");
  return repos.snapshots.upsertMany(userId, rows);
}

export async function cashOnHand(repos: Repositories, userId: string, today: IsoDate): Promise<number | null> {
  const current = periodOf(today);
  const snapshots = await repos.snapshots.listBetween(userId, addMonths(current, -12), current);
  return latestCash(snapshots, current);
}

export { netWorthFor };
