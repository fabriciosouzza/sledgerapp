import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface BackLink {
  href: string;
  label: string;
}

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** The parent screen, for pages the bottom nav does not reach (Settings → Accounts → an account). */
  back?: BackLink;
}) {
  return (
    <header className="mb-4">
      {back && (
        <Link
          href={back.href}
          className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg pr-2 pl-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
