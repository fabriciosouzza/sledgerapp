"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { seedStartingSetAction } from "@/app/(app)/settings/seed-action";
import { Button } from "@/components/ui/button";

/** Empty-state action: create the Portuguese starting accounts and categories. */
export function SeedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await seedStartingSetAction();
          toast.success(result.seeded ? "Starting set created" : "You already have data");
          router.refresh();
        })
      }
    >
      {pending ? "Creating…" : "Create the starting set"}
    </Button>
  );
}
