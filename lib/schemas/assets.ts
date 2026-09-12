import { z } from "zod";
import { isoDateField } from "./entries";
import { boolField, optionalText, requiredText } from "./form";
import { parseBRL } from "@/lib/domain/money";

export const assetClassSchema = z.enum(["fixed_income", "crypto", "foreign_currency", "stocks", "reits", "other"]);

export const assetInputSchema = z.object({
  name: requiredText("Name", 60),
  assetClass: assetClassSchema,
  subclass: optionalText(60),
  broker: optionalText(60),
  isActive: boolField.default(true),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

export const movementKindSchema = z.enum(["contribution", "yield", "market_adjustment", "withdrawal", "fee_tax"]);

/** Only a market adjustment may be negative (§5.7). */
const signedCents = z.preprocess(
  (v) => (typeof v === "string" ? parseBRL(v) : v),
  z.number({ error: "Enter an amount." }).int().refine((n) => n !== 0, { error: "Amount cannot be zero." }),
);

export const movementInputSchema = z
  .object({
    assetId: requiredText("Asset", 36),
    kind: movementKindSchema,
    date: isoDateField,
    amountCents: signedCents,
    notes: optionalText(500),
    /** For contributions: the cash account the money leaves; pairs with an entry (§5.7). */
    fromAccountId: optionalText(36),
    /** The brokerage account that receives it. */
    brokerageAccountId: optionalText(36),
  })
  .superRefine((m, ctx) => {
    if (m.kind !== "market_adjustment" && m.amountCents < 0) {
      ctx.addIssue({ code: "custom", path: ["amountCents"], message: "Only a market adjustment can be negative." });
    }
    if (m.kind === "contribution" && (m.fromAccountId === null) !== (m.brokerageAccountId === null)) {
      ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Pick both the source and the brokerage account, or neither." });
    }
  });

export type MovementInput = z.infer<typeof movementInputSchema>;
