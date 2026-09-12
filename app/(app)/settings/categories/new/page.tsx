import { PageHeader } from "@/components/layout/page-header";
import { CategoryForm } from "@/components/settings/category-form";
import { isTopLevel } from "@/lib/domain/categories";
import { listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { createCategoryAction } from "../actions";

export default async function NewCategoryPage() {
  const { userId, repos } = await getContext();
  const parents = (await listCategories(repos, userId)).filter(isTopLevel);
  return (
    <>
      <PageHeader title="New category" />
      <CategoryForm parents={parents} action={createCategoryAction} />
    </>
  );
}
