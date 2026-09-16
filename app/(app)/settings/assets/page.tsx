import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetClassLabel } from "@/lib/domain/assets";
import { getContext } from "@/lib/services/context";
import { listAssets } from "@/lib/services/portfolio";

export default async function AssetsSettingsPage() {
  const { userId, repos } = await getContext();
  const assets = await listAssets(repos, userId);
  return (
    <>
      <PageHeader back={{ href: "/settings", label: "Settings" }}
        title="Assets"
        action={
          <Button render={<Link href="/settings/assets/new" />} nativeButton={false} size="lg" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        }
      />
      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No assets yet. A CDB, a fund, a coin: anything you put money into.</p>
          <Button render={<Link href="/settings/assets/new" />} nativeButton={false} className="mt-4 h-11">
            Add asset
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {assets.map((a) => (
            <li key={a.id}>
              <Link href={`/settings/assets/${a.id}`} className={`flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring ${a.isActive ? "" : "opacity-60"}`}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.name}</span>
                    <Badge variant="secondary">{assetClassLabel(a.assetClass)}</Badge>
                    {!a.isActive && <Badge variant="outline">inactive</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{[a.subclass, a.broker].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
