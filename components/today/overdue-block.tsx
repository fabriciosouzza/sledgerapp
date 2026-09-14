"use client";

import { useState } from "react";

/**
 * Stays mounted once it has shown something, so an entry settled from here
 * remains visible (checked, undoable) instead of vanishing with the block
 * when the server re-renders with nothing overdue. Hidden only when there
 * was nothing overdue to begin with.
 */
export function OverdueBlock({ children, hasEntries }: { children: React.ReactNode; hasEntries: boolean }) {
  // Latches to true: state initialised from the first render's props and
  // raised, never lowered, when later props bring entries.
  const [shown, setShown] = useState(hasEntries);
  if (hasEntries && !shown) setShown(true);
  if (!shown) return null;
  return (
    <section aria-label="Overdue" className="rounded-xl border border-negative/40 bg-negative/5 p-3 [&_h2]:text-negative">
      {children}
    </section>
  );
}
