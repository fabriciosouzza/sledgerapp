"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Anything a screen throws lands here instead of Next's blank "Application error". */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The screen could not be loaded. Nothing you recorded was lost.
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="flex justify-center gap-2">
        <Button className="h-11" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" className="h-11" render={<Link href="/" />} nativeButton={false}>
          Go home
        </Button>
      </div>
    </div>
  );
}
