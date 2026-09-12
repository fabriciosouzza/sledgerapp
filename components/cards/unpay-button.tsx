"use client";

import { useState } from "react";
import { toast } from "sonner";
import { unpayStatementAction } from "@/app/(app)/cards/actions";
import { Button } from "@/components/ui/button";

export function UnpayButton({ statementId }: { statementId: string }) {
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    const result = await unpayStatementAction(formData);
    setPending(false);
    if (result.error) toast.error(result.error);
    else toast.success("Payment removed");
  }
  return (
    <form action={submit}>
      <input type="hidden" name="statementId" value={statementId} />
      <Button type="submit" variant="ghost" size="sm" className="h-9 text-xs" disabled={pending}>
        {pending ? "…" : "Undo payment"}
      </Button>
    </form>
  );
}
