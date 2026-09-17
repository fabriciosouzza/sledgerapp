import { PageHeader } from "@/components/layout/page-header";
import { CategoryForm } from "@/components/settings/category-form";
import { StarterCategoryChips } from "@/components/settings/starter-category-chips";
import { isTopLevel } from "@/lib/domain/categories";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { missingSeedCategories } from "@/lib/services/seed";
import { createCategoryAction } from "../actions";

export default async function NewCategoryPage() {
  const { userId, repos } = await getContext();
  const [categories, missing] = await Promise.all([listCategories(repos, userId), missingSeedCategories(repos, userId)]);
  const parents = categories.filter(isTopLevel);
  return (
    <>
      <PageHeader back={{ href: "/settings/categories", label: "Categories" }} title="New category" />
      <div className="space-y-5">
        {/* The starter set grew (income categories on 2026-09-17): whoever wants one of them takes it here, one at a time. */}
        <StarterCategoryChips names={missing.map((c) => c.name)} />
        <CategoryForm parents={parents} action={createCategoryAction} />
      </div>
    </>
  );
}
