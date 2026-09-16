import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryForm } from "@/components/settings/category-form";
import { Button } from "@/components/ui/button";
import { isTopLevel } from "@/lib/domain/categories";
import { getCategory, listCategories } from "@/lib/services/categories";
import { getContext } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/errors";
import { deleteCategoryAction, updateCategoryAction } from "../actions";

export default async function EditCategoryPage(props: PageProps<"/settings/categories/[id]">) {
  const { id } = await props.params;
  const { userId, repos } = await getContext();
  const category = await getCategory(repos, userId, id).catch((error: unknown) => {
    if (error instanceof ServiceError && error.code === "not_found") notFound();
    throw error;
  });
  const parents = (await listCategories(repos, userId)).filter((c) => isTopLevel(c) && c.id !== id);

  return (
    <>
      <PageHeader back={{ href: "/settings/categories", label: "Categories" }}
        title={category.name}
        action={
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-lg" aria-label="Delete category" className="size-11">
                <Trash2 aria-hidden />
              </Button>
            }
            title="Delete this category?"
            description="Only possible when no entry, recurrence or sub-category uses it. Otherwise deactivate it."
            confirmLabel="Delete"
            action={deleteCategoryAction}
            fields={{ id: category.id }}
          />
        }
      />
      <CategoryForm category={category} parents={parents} action={updateCategoryAction} />
    </>
  );
}
