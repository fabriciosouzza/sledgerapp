"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { today } from "@/lib/domain/dates";
import { isoDateField } from "@/lib/schemas/entries";
import { firstIssue, formToObject, requiredText } from "@/lib/schemas/form";
import { payStatement, unpayStatement } from "@/lib/services/cards";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";

const paySchema = z.object({
  statementId: requiredText("Statement", 36),
  fromAccountId: requiredText("Account", 36),
  paidOn: isoDateField,
});

function revalidate() {
  for (const path of ["/cards", "/", "/entries", "/net-worth", "/accounts/[id]"]) revalidatePath(path, "page");
}

export async function payStatementAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  const parsed = paySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    await payStatement(repos, userId, parsed.data, today());
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  return {};
}

export async function unpayStatementAction(formData: FormData): Promise<{ error?: string }> {
  const { userId, repos } = await getContext();
  try {
    await unpayStatement(repos, userId, String(formData.get("statementId") ?? ""));
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidate();
  return {};
}
