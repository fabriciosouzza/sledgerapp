import { z } from "zod";
import { parseBRL } from "@/lib/domain/money";
import { requiredId } from "./form";

const centsField = z.preprocess(
  (v) => (typeof v === "string" ? parseBRL(v) : v),
  z.number({ error: "Enter an amount." }).int().positive({ error: "Every part must be more than zero." }),
);

/** One line of where a contribution goes: an asset and how much (§5.2). */
export const allocationLineSchema = z.object({ assetId: requiredId("an asset"), amountCents: centsField });

/** `null` means "not given"; the service decides whether that is allowed (a planned contribution needs none). */
export const allocationField = z.array(allocationLineSchema).nullable().default(null);

export const shareSchema = z.object({
  assetId: requiredId("an asset"),
  sharePercent: z.coerce.number({ error: "Enter a percentage." }).int().min(1).max(100),
});

export const sharesField = z.array(shareSchema).default([]);

/**
 * Forms send an allocation as `allocation:<assetId>` fields (pt-BR amounts,
 * blanks skipped) and a default split as `split:<assetId>` (whole percents);
 * this lifts them into the arrays the schemas expect. Absent fields give
 * `null` / `[]`, so a form without the section parses like a JSON body without it.
 */
export function readAllocationFields(formData: FormData): { allocation: { assetId: string; amountCents: string }[] | null; allocations: { assetId: string; sharePercent: string }[] } {
  const allocation: { assetId: string; amountCents: string }[] = [];
  const allocations: { assetId: string; sharePercent: string }[] = [];
  let sawAllocation = false;
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("allocation:")) {
      sawAllocation = true;
      if (value.trim() !== "") allocation.push({ assetId: key.slice("allocation:".length), amountCents: value });
    } else if (key.startsWith("split:") && value.trim() !== "") {
      allocations.push({ assetId: key.slice("split:".length), sharePercent: value });
    }
  }
  return { allocation: sawAllocation ? allocation : null, allocations };
}
