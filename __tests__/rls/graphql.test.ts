// Test plan
// Goal: unused GraphQL resolves no application data for any client and can be restored exactly.
// Layer: rls (managed test stack HTTP/native SQL plus a run-owned 1.5.11 compatibility database).
// Subject: SE-U3 M3 and all M1/M2/M3 rollback files, GraphQL platform wrappers and dependency safety.
// Allowed paths: normal REST remains covered by profiles/content/coupons; an enabled control resolves courses.
// Denied paths: anon/learner/admin GraphQL reads and mutations, native resolver; dependent DROP.
// Known bugs: none.
// Invariants: all managed DDL is restored; compatibility resources have journaled exact ownership and cleanup.
import { afterEach, beforeEach, it } from "vitest";
import { proveGraphql11511Compatibility } from "./graphql-compat-probe";
import {
  expectGraphDisabled,
  proveManagedGraphqlControl,
} from "./graphql-probe";
import {
  finishFixtureScope,
  fixtureScope,
  IDS,
  startFixtureScope,
} from "./helpers";

beforeEach(async () => {
  startFixtureScope();
  await fixtureScope().acquire("profiles", IDS.learner, ["full_name"]);
});
afterEach(finishFixtureScope);

it.each(["anon", "learner", "admin"] as const)(
  "[G1] %s cannot query or mutate through GraphQL HTTP or RPC",
  expectGraphDisabled,
);
it(
  "[G2] enabled controls resolve real local data; dependency failures preserve GraphQL and the final disabled state",
  proveManagedGraphqlControl,
  60_000,
);
it(
  "[G3] exact 1.5.11 rollback, combined reverse/reapply and partial prefix on an owned compatibility database",
  proveGraphql11511Compatibility,
  300_000,
);
