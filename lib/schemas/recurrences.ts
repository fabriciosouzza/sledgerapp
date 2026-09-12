import { z } from "zod";
import { needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { isoDateField, optionalIsoDate, requiredCents } from "./entries";
import { boolField, optionalInt, optionalText, requiredText } from "./form";

export const recurrenceInputSchema = z
  .object({
    description: requiredText("Description", 120),
    kind: z.enum(["income", "expense", "contribution", "transfer"]),
    categoryId: optionalText(36),
    accountId: requiredText("Account", 36),
    counterAccountId: optionalText(36),
    amountCents: requiredCents,
    dueDay: optionalInt(1, 31),
    startsOn: isoDateField,
    endsOn: optionalIsoDate,
    isVariable: boolField.default(false),
    isActive: boolField.default(true),
  })
  .superRefine((r, ctx) => {
    if (r.dueDay === null) ctx.addIssue({ code: "custom", path: ["dueDay"], message: "Pick the due day." });
    if (needsCategory(r.kind) && r.categoryId === null) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pick a category." });
    if (needsCounterAccount(r.kind)) {
      if (r.counterAccountId === null) ctx.addIssue({ code: "custom", path: ["counterAccountId"], message: "Pick the destination account." });
      else if (r.counterAccountId === r.accountId) ctx.addIssue({ code: "custom", path: ["counterAccountId"], message: "Source and destination must differ." });
    }
    if (r.endsOn !== null && r.endsOn < r.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "End must be after start." });
  });

export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
