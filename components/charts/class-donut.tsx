"use client";

import { assetClassLabel } from "@/lib/domain/assets";
import type { AssetClass } from "@/lib/domain/types";
import { Donut } from "./donut";

export function ClassDonut({ data }: { data: { assetClass: AssetClass; balanceCents: number }[] }) {
  return <Donut slices={data.map((d) => ({ name: assetClassLabel(d.assetClass), cents: d.balanceCents }))} label="Balance by asset class" centerLabel="balance" />;
}
