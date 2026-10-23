// Test plan
// Goal: coupons are not readable through the API; the server reads them with the service role (H2-1b P2).
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: RLS on public.coupons, which has no SELECT policy after H2-1b.
// Allowed paths: none for anon and learner.
// Denied paths: anon and a learner read no coupon rows.
// Known bugs: none.
// Invariants: reads only; nothing is written.
import { describe, expect, it } from "vitest";
import { anon, fixtures, learner, must } from "./helpers";

describe("coupons", () => {
  it.each([
    ["anon", anon],
    ["learner", learner],
  ] as const)("[E7] %s reads no coupons", async (_actor, client) => {
    expect(must(await fixtures.from("coupons").select("id"))).toHaveLength(1);

    const { data, error } = await client.from("coupons").select("id, code");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
