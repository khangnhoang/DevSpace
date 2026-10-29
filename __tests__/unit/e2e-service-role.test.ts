// Test plan
// Goal: Auth failures never masquerade as verified absence or successful owned cleanup.
// Layer: unit, controlled SDK responses; persistence is covered by fixture-ownership integration tests.
// Subject: exact-ID Auth lookup and deletion.
// Allowed paths: explicit absence and verified deletion.
// Denied paths: lookup/delete errors, inconclusive response and residual user.
// Known bugs: none.
// Invariants: no database/network access and no user enumeration.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userExists, deleteOwnedUser } from "../helpers/fixture-ownership";
const auth = { getUserById: vi.fn(), deleteUser: vi.fn() };
const db = { auth: { admin: auth } } as unknown as SupabaseClient;
const missing = { message: "User not found", status: 404, code: "user_not_found" };
const unavailable = { message: "Auth unavailable", status: 503, code: "unexpected_failure" };
const user = { id: "fixture-id" };
beforeEach(() => {
  vi.resetAllMocks();
  auth.getUserById.mockResolvedValue({ data: { user: null }, error: missing });
  auth.deleteUser.mockResolvedValue({ data: { user }, error: null });
});
describe("userExists", () => {
  it("reports an existing user", async () => {
    auth.getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(userExists(db, user.id)).resolves.toBe(true);
  });
  it("reports only explicit user-not-found as absence", async () => { await expect(userExists(db, user.id)).resolves.toBe(false); });
  it.each([unavailable, { message: "Unknown endpoint", status: 404, code: "unknown" }])("preserves $message", async error => {
    auth.getUserById.mockResolvedValue({ data: { user: null }, error });
    await expect(userExists(db, user.id)).rejects.toThrow(error.message);
  });
  it("rejects an inconclusive empty response", async () => {
    auth.getUserById.mockResolvedValue({ data: { user: null }, error: null });
    await expect(userExists(db, user.id)).rejects.toThrow("no user and no error");
  });
});
describe("exact-ID cleanup", () => {
  it("does not delete an already absent user", async () => { await deleteOwnedUser(db, user.id); expect(auth.deleteUser).not.toHaveBeenCalled(); });
  it("fails before deletion when lookup fails", async () => {
    auth.getUserById.mockResolvedValue({ data: { user: null }, error: unavailable });
    await expect(deleteOwnedUser(db, user.id)).rejects.toThrow("getUserById failed");
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
  it("preserves a delete failure", async () => {
    auth.getUserById.mockResolvedValue({ data: { user }, error: null });
    auth.deleteUser.mockResolvedValue({ data: { user: null }, error: unavailable });
    await expect(deleteOwnedUser(db, user.id)).rejects.toThrow("deleteUser failed");
  });
  it("verifies deletion by the owned ID", async () => {
    auth.getUserById.mockResolvedValueOnce({ data: { user }, error: null });
    await deleteOwnedUser(db, user.id);
    expect(auth.deleteUser).toHaveBeenCalledWith(user.id);
    expect(auth.getUserById).toHaveBeenCalledTimes(2);
  });
  it("rejects a successful delete that leaves a residual user", async () => {
    auth.getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(deleteOwnedUser(db, user.id)).rejects.toThrow("cleanup left user");
  });
  it("preserves the post-delete lookup failure", async () => {
    auth.getUserById.mockResolvedValueOnce({ data: { user }, error: null }).mockResolvedValueOnce({ data: { user: null }, error: unavailable });
    await expect(deleteOwnedUser(db, user.id)).rejects.toThrow("getUserById failed");
  });
});
