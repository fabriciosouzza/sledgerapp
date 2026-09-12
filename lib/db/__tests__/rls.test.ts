// Acceptance 13 (PROMPT.md §12): user A can neither read nor write user B's
// rows. Needs a real database and two JWTs, so it runs only when the local
// Supabase is reachable: `make test-db` (see the Makefile) sets the variables.

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../database.types";

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

type Client = ReturnType<typeof createClient<Database>>;

async function signedInClient(email: string, password: string): Promise<{ client: Client; userId: string }> {
  const admin = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, userId: data.user.id };
}

describe.skipIf(!enabled)("row level security", () => {
  const stamp = Date.now();
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  let accountOfA: string;

  beforeAll(async () => {
    a = await signedInClient(`rls-a-${stamp}@test.local`, "rls-test-password-1");
    b = await signedInClient(`rls-b-${stamp}@test.local`, "rls-test-password-2");
    const { data, error } = await a.client.from("accounts").insert({ user_id: a.userId, name: "A's account", type: "checking" }).select("id").single();
    if (error) throw error;
    accountOfA = data.id;
  });

  afterAll(async () => {
    const admin = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    for (const user of [a, b]) if (user) await admin.auth.admin.deleteUser(user.userId);
  });

  it("hides A's rows from B", async () => {
    const { data, error } = await b.client.from("accounts").select("id").eq("id", accountOfA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("stops B from updating or deleting A's rows", async () => {
    const update = await b.client.from("accounts").update({ name: "hijacked" }).eq("id", accountOfA).select("id");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);

    const del = await b.client.from("accounts").delete().eq("id", accountOfA).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toEqual([]);

    const still = await a.client.from("accounts").select("name").eq("id", accountOfA).single();
    expect(still.data?.name).toBe("A's account");
  });

  it("stops B from inserting rows as A", async () => {
    const { error } = await b.client.from("accounts").insert({ user_id: a.userId, name: "forged", type: "cash" });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501"); // insufficient_privilege: the with-check clause
  });

  // Acceptance 10: status = 'settled' without settled_on is rejected by the database.
  it("rejects settled without settled_on", async () => {
    const category = await a.client.from("categories").insert({ user_id: a.userId, name: "Teste", applies_to: ["expense"] }).select("id").single();
    const { error } = await a.client.from("entries").insert({
      user_id: a.userId,
      date: "2026-11-05",
      kind: "expense",
      status: "settled",
      settled_on: null,
      amount_cents: 100,
      description: "bad",
      category_id: category.data!.id,
      account_id: accountOfA,
    });
    expect(error?.code).toBe("23514");
  });
});
