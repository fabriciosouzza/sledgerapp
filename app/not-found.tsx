import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Not here</h1>
      <p className="text-sm text-muted-foreground">That page does not exist, or the entry it pointed at is gone.</p>
      <Button className="h-11" render={<Link href="/" />} nativeButton={false}>
        Go home
      </Button>
    </div>
  );
}
