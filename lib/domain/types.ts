// Domain types. Pure data, camelCase; repositories map database rows to these.
// Dates are ISO strings (`YYYY-MM-DD`) — a `date` column, never a timestamp,
// so "the 5th" stays the 5th regardless of timezone (PROMPT.md §8).

export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit_card"
  | "other";
export type EntryKind = "income" | "expense" | "contribution" | "redemption" | "transfer";
export type EntryStatus = "planned" | "settled";
export type EntrySource = "manual" | "recurrence" | "installment";
export type AssetClass =
  | "fixed_income"
  | "crypto"
  | "foreign_currency"
  | "stocks"
  | "reits"
  | "other";
export type MovementKind =
  | "contribution"
  | "yield"
  | "market_adjustment"
  | "withdrawal"
  | "fee_tax";

/** `YYYY-MM-DD` */
export type IsoDate = string;
/** `YYYY-MM` */
export type Period = string;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  closingDay: number | null;
  dueDay: number | null;
  creditLimitCents: number | null;
  /** Where a cash account's balance starts (DESIGN.md: balances are derived). */
  openingBalanceCents: number;
  openingOn: IsoDate;
  /** A savings account can be a goal: how much it is meant to reach. */
  targetCents: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  appliesTo: EntryKind[] | null;
  monthlyCapCents: number | null;
  /** Money that arrives with its destination set (meal voucher, allowance): out of the second savings rate (§5.8). */
  isEarmarked: boolean;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** One line of a recurring contribution's default split (§5.5). */
export interface RecurrenceShare {
  assetId: string;
  /** 1–100; a recurrence's shares sum to 100. */
  sharePercent: number;
}

export interface Recurrence {
  id: string;
  description: string;
  kind: EntryKind;
  categoryId: string | null;
  accountId: string;
  counterAccountId: string | null;
  amountCents: number;
  dueDay: number;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  isVariable: boolean;
  isActive: boolean;
  /** Empty unless the recurrence is a contribution with a default split. */
  allocations: RecurrenceShare[];
  /** Months (first day, ISO) the template was told not to apply to — a holiday month with no voucher. */
  skippedPeriods: IsoDate[];
}

export interface Entry {
  id: string;
  date: IsoDate;
  settledOn: IsoDate | null;
  kind: EntryKind;
  status: EntryStatus;
  amountCents: number;
  description: string;
  categoryId: string | null;
  accountId: string;
  counterAccountId: string | null;
  notes: string | null;
  source: EntrySource;
  recurrenceId: string | null;
  period: IsoDate | null;
  installmentGroupId: string | null;
  installmentNo: number | null;
  installmentTotal: number | null;
  statementId: string | null;
}

/** An entry before it has an id — what domain functions produce for insertion. */
export type NewEntry = Omit<Entry, "id">;

export interface Statement {
  id: string;
  accountId: string;
  cycleStart: IsoDate;
  cycleEnd: IsoDate;
  dueDate: IsoDate;
  paidOn: IsoDate | null;
}

export interface Asset {
  id: string;
  name: string;
  assetClass: AssetClass;
  subclass: string | null;
  broker: string | null;
  isActive: boolean;
}

export interface AssetMovement {
  id: string;
  assetId: string;
  date: IsoDate;
  kind: MovementKind;
  amountCents: number;
  /** The cash entry this movement is one side of: a contribution split across assets is one entry, N movements (§5.2). */
  entryId: string | null;
  notes: string | null;
}

/** Where a settled contribution (or redemption) goes: one line per asset, summing to the entry's amount. */
export interface AllocationLine {
  assetId: string;
  amountCents: number;
}

