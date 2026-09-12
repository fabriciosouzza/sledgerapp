import { z } from "zod";
import { boolField, multiField, optionalCents, optionalText, requiredText } from "./form";

export const entryKindSchema = z.enum(["income", "expense", "contribution", "transfer"]);

export const categoryInputSchema = z.object({
  name: requiredText("Name", 60),
  parentId: optionalText(36),
  appliesTo: multiField(["income", "expense"]),
  monthlyCapCents: optionalCents,
  isBenefit: boolField.default(false),
  color: optionalText(20),
  icon: optionalText(40),
  isActive: boolField.default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
