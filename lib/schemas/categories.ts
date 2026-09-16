import { z } from "zod";
import { boolField, multiField, optionalCents, optionalId, optionalText, requiredText } from "./form";

export const entryKindSchema = z.enum(["income", "expense", "contribution", "redemption", "transfer"]);

export const categoryInputSchema = z.object({
  name: requiredText("Name", 60),
  parentId: optionalId(),
  appliesTo: multiField(["income", "expense"]),
  monthlyCapCents: optionalCents,
  isEarmarked: boolField.default(false),
  color: optionalText(20),
  icon: optionalText(40),
  isActive: boolField.default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
