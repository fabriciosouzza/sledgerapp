import { z } from "zod";
import { isIsoDate } from "@/lib/domain/dates";
import { canBeInstallments, needsCategory, needsCounterAccount } from "@/lib/domain/entries";
import { parseBRL } from "@/lib/domain/money";
import { boolField, optionalInt, optionalText, requiredText } from "./form";

export const entryKindSchema = z.enum(["income", "expense", "contribution", "transfer"]);

export const isoDateField = z
  .string({ error: "Enter a date." })
  .refine((v) => isIsoDate(v), { error: "Enter a valid date." });

export const optionalIsoDate = z
  .preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), isoDateField.nullable())
  .default(null);

export const requiredCents = z.preprocess(
  (v) => (typeof v === "string" ? parseBRL(v) : v),
  z
    .number({ error: "Enter an amount." })
    .int()
    .positive({ error: "Amount must be greater than zero." }),
);

export const entryInputSchema = z
  .object({
    kind: entryKindSchema,
    amountCents: requiredCents,
    date: isoDateField,
    description: requiredText("Description", 120),
    categoryId: optionalText(36),
    accountId: requiredText("Account", 36),
    counterAccountId: optionalText(36),
    notes: optionalText(500),
    settled: boolField.default(false),
    settledOn: optionalIsoDate,
    installments: boolField.default(false),
    installmentParts: optionalInt(2, 120),
    repeatMonthly: boolField.default(false),
  })
  .superRefine((e, ctx) => {
    if (needsCategory(e.kind) && e.categoryId === null) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pick a category." });
    }
    if (needsCounterAccount(e.kind)) {
      if (e.counterAccountId === null) {
        ctx.addIssue({ code: "custom", path: ["counterAccountId"], message: "Pick the destination account." });
      } else if (e.counterAccountId === e.accountId) {
        ctx.addIssue({ code: "custom", path: ["counterAccountId"], message: "Source and destination must differ." });
      }
    }
    if (e.installments) {
      if (!canBeInstallments(e.kind)) {
        ctx.addIssue({ code: "custom", path: ["installments"], message: "Only expenses and income can be split." });
      }
      if (e.installmentParts === null) {
        ctx.addIssue({ code: "custom", path: ["installmentParts"], message: "How many parts?" });
      }
      if (e.repeatMonthly) {
        ctx.addIssue({ code: "custom", path: ["repeatMonthly"], message: "An installment plan cannot also repeat monthly." });
      }
    }
  });

export type EntryInput = z.infer<typeof entryInputSchema>;

/** What an edit may change; installment and recurrence flags are not editable. */
export const entryUpdateSchema = z
  .object({
    id: requiredText("Entry", 36),
    kind: entryKindSchema,
    amountCents: requiredCents,
    date: isoDateField,
    description: requiredText("Description", 120),
    categoryId: optionalText(36),
    accountId: requiredText("Account", 36),
    counterAccountId: optionalText(36),
    notes: optionalText(500),
    settled: boolField.default(false),
    settledOn: optionalIsoDate,
    scope: z.enum(["this", "this_and_future", "all"]).default("this"),
  })
  .superRefine((e, ctx) => {
    if (needsCategory(e.kind) && e.categoryId === null) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pick a category." });
    }
    if (needsCounterAccount(e.kind)) {
      if (e.counterAccountId === null) {
        ctx.addIssue({ code: "custom", path: ["counterAccountId"], message: "Pick the destination account." });
      } else if (e.counterAccountId === e.accountId) {
        ctx.addIssue({ code: "custom", path: ["counterAccountId"], message: "Source and destination must differ." });
      }
    }
  });

export type EntryUpdate = z.infer<typeof entryUpdateSchema>;

export const installmentScopeSchema = z.enum(["this", "this_and_future", "all"]);
