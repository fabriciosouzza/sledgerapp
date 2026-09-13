"use client";

import { toast } from "sonner";
import { unpayStatementAction } from "@/app/(app)/cards/actions";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Removes the payment transfer and puts the installment parts back to planned — so it asks first. */
export function UnpayButton({ statementId, label }: { statementId: string; label: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="h-9 text-xs">
          Undo payment
        </Button>
      }
      title={`Undo the payment of ${label}?`}
      description="The transfer that paid it is deleted and its installment parts go back to planned. You can pay it again afterwards."
      confirmLabel="Undo payment"
      fields={{ statementId }}
      action={async (formData) => {
        const result = await unpayStatementAction(formData);
        if (result.error) return { error: result.error };
        toast.success("Payment removed");
      }}
    />
  );
}
