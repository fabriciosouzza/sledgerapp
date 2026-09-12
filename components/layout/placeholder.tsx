import { PageHeader } from "./page-header";

/** Stands in for a screen until its stage lands (PROMPT.md §11). */
export function Placeholder({ title, stage }: { title: string; stage: number }) {
  return (
    <>
      <PageHeader title={title} />
      <p className="text-sm text-muted-foreground">Arrives in stage {stage}.</p>
    </>
  );
}
