"use client";

import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { unpayStatementAction } from "@/app/(app)/cards/actions";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Removes the payment transfer and puts the installment parts back to planned — so it asks first. */
export function UnpayButton({ statementId, label, compact = false }: { statementId: string; label: string; compact?: boolean }) {
  return (
    <ConfirmDialog
      trigger={
        compact ? (
          <Button variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={`Undo the payment of ${label}`} title="Undo payment">
            <Undo2 aria-hidden />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-9 text-xs">
            Undo payment
          </Button>
        )
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
