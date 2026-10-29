// Test plan
// Goal: Auth failures must not masquerade as a deleted fixture or successful cleanup.
// Layer: unit; SDK responses are controlled, no database or network access.
// Subject: userExists and the Auth part of removeE2eFixtures.
// Allowed paths: existing user, explicit user-not-found, verified cleanup.
// Denied paths: lookup/list/delete errors, inconclusive lookup, residual user.
// Known bugs: none in this result-handling contract; ownership is deferred to FEAT-022.
// Invariants: no real client, credentials, database writes or persistent fixture data.
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUserById: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
}));

// Exercise the real helper's result handling without a database or Auth server.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ delete: () => ({ like: () => ({ select: async () => ({ data: [], error: null }) }) }) }),
    auth: { admin: auth },
  }),
}));
vi.mock("../helpers/local-stack", () => ({
  readLocalStack: () => ({ apiUrl: "http://127.0.0.1:54321", serviceRoleKey: "fixture-only-key" }),
}));

import { removeE2eFixtures, userExists } from "../e2e/service-role";

const missing = { message: "User not found", status: 404, code: "user_not_found" };
const unavailable = { message: "Auth unavailable", status: 503, code: "unexpected_failure" };
const user = { id: "fixture-id", email: "e2e-delete@devspace.test" };

beforeEach(() => {
  vi.resetAllMocks();
  auth.getUserById.mockResolvedValue({ data: { user: null }, error: missing });
  auth.listUsers.mockResolvedValue({ data: { users: [user] }, error: null });
  auth.deleteUser.mockResolvedValue({ data: { user }, error: null });
});

describe("userExists", () => {
  it("reports an existing user", async () => {
    auth.getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(userExists(user.id)).resolves.toBe(true);
  });

  it("reports absence only for the explicit user-not-found response", async () => {
    await expect(userExists(user.id)).resolves.toBe(false);
  });

  it.each([unavailable, { message: "Unknown endpoint", status: 404, code: "unknown" }])(
    "fails instead of reporting absence for $message",
    async (error) => {
      auth.getUserById.mockResolvedValue({ data: { user: null }, error });
      await expect(userExists(user.id)).rejects.toThrow(error.message);
    },
  );

  it("rejects an inconclusive empty response", async () => {
    auth.getUserById.mockResolvedValue({ data: { user: null }, error: null });
    await expect(userExists(user.id)).rejects.toThrow("no user and no error");
  });
});

describe("Auth fixture cleanup", () => {
  it("fails when users cannot be listed", async () => {
    auth.listUsers.mockResolvedValue({ data: { users: [] }, error: unavailable });
    await expect(removeE2eFixtures()).rejects.toThrow("listUsers failed");
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("fails when deleting a fixture is refused", async () => {
    auth.deleteUser.mockResolvedValue({ data: { user: null }, error: unavailable });
    await expect(removeE2eFixtures()).rejects.toThrow("deleteUser failed");
  });

  it("verifies the fixture is absent after deletion", async () => {
    await expect(removeE2eFixtures()).resolves.toBeUndefined();
    expect(auth.deleteUser).toHaveBeenCalledWith(user.id);
    expect(auth.getUserById).toHaveBeenCalledWith(user.id);
  });

  it("fails when a successful delete leaves the fixture present", async () => {
    auth.getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(removeE2eFixtures()).rejects.toThrow("cleanup left user");
  });

  it("fails when deletion cannot be verified", async () => {
    auth.getUserById.mockResolvedValue({ data: { user: null }, error: unavailable });
    await expect(removeE2eFixtures()).rejects.toThrow("getUserById failed");
  });
});
