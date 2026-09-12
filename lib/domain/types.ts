// Domain types. Pure data, camelCase; repositories map database rows to these.
// Dates are ISO strings (`YYYY-MM-DD`) — a `date` column, never a timestamp,
// so "the 5th" stays the 5th regardless of timezone (PROMPT.md §8).

export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit_card"
  | "brokerage"
  | "other";
export type EntryKind = "income" | "expense" | "contribution" | "transfer";
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
  isActive: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  appliesTo: EntryKind[] | null;
  monthlyCapCents: number | null;
  isBenefit: boolean;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
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
  entryId: string | null;
  notes: string | null;
}

