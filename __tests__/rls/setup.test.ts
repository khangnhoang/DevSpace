// Test plan
// Goal: prove the rls global setup hands every file a local stack and a working token per actor.
// Layer: rls (local Supabase stack).
// Subject: __tests__/rls/global-setup.ts and the values it provides.
// Allowed paths: a signed-in actor token identifies that actor at the local Auth endpoint.
// Denied paths: a URL that is not the local stack never reaches a test.
// Known bugs: none.
// Invariants: reads only; nothing is written.
import { describe, expect, inject, it } from "vitest";
import { assertLocalUrl } from "../helpers/local-stack";

const stack = inject("localStack");

describe("rls global setup", () => {
  it("provides URLs that point at the local stack", () => {
    expect(assertLocalUrl("API URL", stack.apiUrl, ["http:", "https:"])).toBe(stack.apiUrl);
    expect(assertLocalUrl("database URL", stack.dbUrl, ["postgresql:", "postgres:"])).toBe(stack.dbUrl);
  });

  it.each([
    ["learner", "learner@devspace.test"],
    ["student", "student@devspace.test"],
    ["admin", "admin@devspace.test"],
  ] as const)("provides a token that identifies %s", async (actor, email) => {
    const response = await fetch(`${stack.apiUrl}/auth/v1/user`, {
      headers: { apikey: stack.anonKey, Authorization: `Bearer ${stack.tokens[actor]}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ email });
  });
});
