import { z } from "zod";
import { z as zod } from "zod";
import { isIsoDate } from "@/lib/domain/dates";
import { parseBRL } from "@/lib/domain/money";
import { boolField, optionalCents, optionalInt, optionalText, requiredText } from "./form";

/** A balance may be zero; negative means an overdraft, which is fine. */
const openingCents = zod.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? 0 : parseBRL(v)) : v), zod.number({ error: "Enter an amount like 1.234,56." }).int()).default(0);
const openingDate = zod.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), zod.string().refine((v) => isIsoDate(v), { error: "Enter a valid date." }).optional());

export const accountTypeSchema = z.enum(["checking", "savings", "cash", "credit_card", "brokerage", "other"]);

export const accountInputSchema = z
  .object({
    name: requiredText("Name", 60),
    type: accountTypeSchema,
    institution: optionalText(60),
    closingDay: optionalInt(1, 31),
    dueDay: optionalInt(1, 31),
    creditLimitCents: optionalCents,
    /** Where the balance starts (cash accounts). */
    openingBalanceCents: openingCents,
    openingOn: openingDate,
    isActive: boolField.default(true),
  })
  .superRefine((a, ctx) => {
    if (a.type !== "credit_card") return;
    if (a.closingDay === null) ctx.addIssue({ code: "custom", path: ["closingDay"], message: "A card needs a closing day." });
    if (a.dueDay === null) ctx.addIssue({ code: "custom", path: ["dueDay"], message: "A card needs a due day." });
  });

export type AccountInput = z.infer<typeof accountInputSchema>;
