import { movementSign } from "@/lib/domain/portfolio";
import type { AssetMovement } from "@/lib/domain/types";

/** Amount with the movement's sign applied, for display. */
export function signedMovementCents(m: Pick<AssetMovement, "kind" | "amountCents">): number {
  return movementSign(m.kind) * m.amountCents;
}
