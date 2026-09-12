import Link from "next/link";
import { ChevronRight, CornerDownRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { SeedButton } from "@/components/settings/seed-button";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/domain/money";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";

export default async function CategoriesPage() {
  const { userId, repos } = await getContext();
  const categories = await listCategories(repos, userId);

  return (
    <>
      <PageHeader
        title="Categories"
        action={
          <Button render={<Link href="/settings/categories/new" />} nativeButton={false} size="lg" className="h-11">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        }
      />
      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No categories yet. Every income and expense needs one.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button render={<Link href="/settings/categories/new" />} nativeButton={false} className="h-11">
              Add category
            </Button>
            <SeedButton />
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/settings/categories/${c.id}`}
                className={`flex min-h-14 items-center gap-3 py-3 pr-4 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring ${
                  c.parentId ? "pl-8" : "pl-4"
                } ${c.isActive ? "" : "opacity-60"}`}
              >
                {c.parentId && <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    {c.isBenefit && <Badge variant="secondary">benefit</Badge>}
                    {!c.isActive && <Badge variant="outline">inactive</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {(c.appliesTo ?? ["expense", "income"]).join(" · ")}
                    {c.monthlyCapCents ? ` · cap ${formatBRL(c.monthlyCapCents)}` : ""}
                  </span>
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
