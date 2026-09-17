"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { seedMissingCategoriesAction } from "@/app/(app)/settings/seed-action";
import { Button } from "@/components/ui/button";

/** The starter categories this account does not have yet, one tap to add them all. */
export function SeedMissingButton({ names }: { names: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      title={names.join(", ")}
      onClick={() =>
        startTransition(async () => {
          const result = await seedMissingCategoriesAction();
          toast.success(result.added === 0 ? "Nothing to add" : `Added ${result.added} ${result.added === 1 ? "category" : "categories"}: ${names.join(", ")}`);
          router.refresh();
        })
      }
    >
      <Sparkles data-icon="inline-start" aria-hidden />
      {pending ? "Adding…" : `Add the ${names.length} starter ${names.length === 1 ? "category" : "categories"} you do not have`}
    </Button>
  );
}
