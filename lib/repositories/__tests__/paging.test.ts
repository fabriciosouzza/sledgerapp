import { describe, expect, it } from "vitest";
import { fetchAll, PAGE_SIZE } from "../errors";

/** A fake PostgREST builder: `range` slices a fixed row set, capped like the real one. */
function source(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  let calls = 0;
  return {
    calls: () => calls,
    query: () => ({
      async range(from: number, to: number) {
        calls++;
        return { data: rows.slice(from, to + 1), error: null };
      },
    }),
  };
}

describe("fetchAll", () => {
  it("pages until a short page and keeps every row once", async () => {
    const s = source(PAGE_SIZE * 2 + 5);
    const rows = await fetchAll(s.query);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(s.calls()).toBe(3);
  });

  it("stops after one page when the set is small", async () => {
    const s = source(3);
    expect(await fetchAll(s.query)).toHaveLength(3);
    expect(s.calls()).toBe(1);
  });

  it("surfaces the driver error", async () => {
    await expect(fetchAll(() => ({ async range() { return { data: null, error: { message: "boom", code: "XX000", details: null, hint: null } }; } }))).rejects.toThrow();
  });
});
