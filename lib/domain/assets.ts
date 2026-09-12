import type { AssetClass, MovementKind } from "./types";

export const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "fixed_income", label: "Fixed income" },
  { value: "stocks", label: "Stocks" },
  { value: "reits", label: "REITs" },
  { value: "crypto", label: "Crypto" },
  { value: "foreign_currency", label: "Foreign currency" },
  { value: "other", label: "Other" },
];

export function assetClassLabel(value: AssetClass): string {
  return ASSET_CLASSES.find((c) => c.value === value)?.label ?? value;
}

export const MOVEMENT_KINDS: { value: MovementKind; label: string; hint: string }[] = [
  { value: "contribution", label: "Contribution", hint: "New money in; pairs with a contribution entry." },
  { value: "yield", label: "Yield", hint: "Interest or dividends, entered by hand. Not income." },
  { value: "market_adjustment", label: "Market adjustment", hint: "Broker balance minus recorded balance; may be negative." },
  { value: "withdrawal", label: "Withdrawal", hint: "Money out." },
  { value: "fee_tax", label: "Fee / tax", hint: "Cost." },
];

export function movementKindLabel(value: MovementKind): string {
  return MOVEMENT_KINDS.find((k) => k.value === value)?.label ?? value;
}
