"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMovementAction } from "@/app/(app)/portfolio/actions";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Button } from "@/components/ui/button";
import { movementKindLabel } from "@/lib/domain/assets";
import { formatDate } from "@/lib/domain/dates";
import { signedMovementCents } from "./sign";
import { formatBRL } from "@/lib/domain/money";
import type { AssetMovement } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function MovementList({ movements }: { movements: AssetMovement[] }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const visible = movements.filter((m) => !removed.has(m.id));
  if (visible.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No movements yet.</p>;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {visible.map((m) => {
        const signed = signedMovementCents(m);
        return (
          <li key={m.id} className="flex min-h-14 items-center gap-3 py-2 pr-1 pl-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{movementKindLabel(m.kind)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {formatDate(m.date)}
                {m.entryId ? " · paired with a cash entry" : ""}
                {m.notes ? ` · ${m.notes}` : ""}
              </span>
            </span>
            <span className={cn("shrink-0 text-sm font-semibold tabular-nums", signed < 0 ? "text-negative" : "text-positive")}>
              {signed > 0 ? "+" : ""}
              {formatBRL(signed)}
            </span>
            <Link href={`/portfolio/movements/${m.id}`} aria-label="Edit movement" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              <Pencil className="size-4" aria-hidden />
            </Link>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon-lg" aria-label="Delete movement" className="size-11 text-muted-foreground">
                  <Trash2 aria-hidden />
                </Button>
              }
              title="Delete this movement?"
              description={m.entryId ? "The paired cash entry goes with it." : "This cannot be undone."}
              confirmLabel="Delete"
              action={async (formData) => {
                const result = await deleteMovementAction(formData);
                if (!result.error) {
                  setRemoved((prev) => new Set(prev).add(m.id));
                  toast.success("Movement deleted");
                }
                return result;
              }}
              fields={{ id: m.id }}
            />
          </li>
        );
      })}
    </ul>
  );
}
