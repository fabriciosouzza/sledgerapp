// Helpers for schemas that parse FormData: empty strings mean "not given",
// checkboxes arrive as "on", amounts arrive typed in pt-BR.

import { z } from "zod";
import { parseBRL } from "@/lib/domain/money";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const optionalText = (max = 120) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable()).default(null);

export const requiredText = (label: string, max = 120) =>
  z.string({ error: `${label} is required.` }).trim().min(1, { error: `${label} is required.` }).max(max);

export const optionalInt = (min: number, max: number) =>
  z.preprocess(blankToNull, z.coerce.number().int().min(min).max(max).nullable()).default(null);

/** An amount typed as `1.234,56` (or already in cents when `inCents`), stored as positive cents. */
export const optionalCents = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || v.trim() === "") return null;
  return parseBRL(v);
}, z.number({ error: "Enter an amount like 1.234,56." }).int().positive({ error: "Amount must be positive." }).nullable()).default(null);

/** Checkbox or switch: present ("on"/"true") means true. */
export const boolField = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Multi-value field: FormData.getAll() gives an array; a single value gives a string. */
export const multiField = <T extends string>(values: readonly [T, ...T[]]) =>
  z.preprocess(
    (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.enum(values)),
  );

/** FormData → object; repeated keys become arrays so `multiField` sees them all. */
export function formToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = key.endsWith("[]") ? values : (values[values.length - 1] ?? "");
    if (key.endsWith("[]")) {
      out[key.slice(0, -2)] = values;
      delete out[key];
    }
  }
  return out;
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
