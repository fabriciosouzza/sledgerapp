"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { seedMissingCategoriesAction } from "@/app/(app)/settings/seed-action";
import { cn } from "@/lib/utils";

/**
 * Starter categories the account does not have, one chip each: a tap adds
 * that one. Offered where a category is being created, never as a nag on
 * the list — a starter category deleted on purpose stays deleted.
 */
export function StarterCategoryChips({ names }: { names: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (names.length === 0) return null;
  return (
    <div className="space-y-2 rounded-xl bg-muted/40 p-4">
      <p className="text-sm font-medium">Or add one from the starter set</p>
      <div className="flex flex-wrap gap-2">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await seedMissingCategoriesAction([name]);
                if (result.added === 0) toast.error(`${name} could not be added.`);
                else toast.success(`Added ${name}`);
                router.refresh();
              })
            }
            className={cn(
              "inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
              pending && "opacity-50",
            )}
          >
            <Plus className="size-4 text-muted-foreground" aria-hidden />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
