import { z } from "zod";
import { boolField, optionalCents, optionalInt, optionalText, requiredText } from "./form";

export const accountTypeSchema = z.enum(["checking", "savings", "cash", "credit_card", "brokerage", "other"]);

export const accountInputSchema = z
  .object({
    name: requiredText("Name", 60),
    type: accountTypeSchema,
    institution: optionalText(60),
    closingDay: optionalInt(1, 31),
    dueDay: optionalInt(1, 31),
    creditLimitCents: optionalCents,
    isActive: boolField.default(true),
  })
  .superRefine((a, ctx) => {
    if (a.type !== "credit_card") return;
    if (a.closingDay === null) ctx.addIssue({ code: "custom", path: ["closingDay"], message: "A card needs a closing day." });
    if (a.dueDay === null) ctx.addIssue({ code: "custom", path: ["dueDay"], message: "A card needs a due day." });
  });

export type AccountInput = z.infer<typeof accountInputSchema>;
