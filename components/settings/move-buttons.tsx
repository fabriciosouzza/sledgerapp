import { ChevronDown, ChevronUp } from "lucide-react";

/** Up/down reordering for a list row; each press is one server action. */
export function MoveButtons({ id, action, first, last }: { id: string; action: (formData: FormData) => Promise<void>; first: boolean; last: boolean }) {
  return (
    <div className="flex shrink-0 flex-col">
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value={direction} />
          <button
            type="submit"
            aria-label={direction === "up" ? "Move up" : "Move down"}
            disabled={direction === "up" ? first : last}
            className="flex h-6 w-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {direction === "up" ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </button>
        </form>
      ))}
    </div>
  );
}
