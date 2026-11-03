// Test plan
// Goal: profiles are readable only by their owner or an admin, the public card exposes no private column,
//   and a user cannot raise their own role.
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: policies and grants on public.profiles and public.profile_cards, prevent_role_escalation,
//   public.is_admin(), and public.handle_new_user() (H1, H2-1a, H2-1b); Auth's minimum password length (BL-P11).
// Allowed paths: self and admin read profiles; anyone reads profile_cards; admin changes another user's role;
//   a new sign-up becomes a plain user; a sign-up with an 8-character password.
// Denied paths: anon reads profiles; a learner reads another profile, writes through profile_cards, changes
//   their own role, or updates another profile; anon and authenticated cannot execute handle_new_user;
//   a sign-up with a 7-character password.
// Known bugs: P28 (K3), a user can change their own profiles.email.
// Invariants: every write is restored afterwards through the service role; the sign-up user is deleted.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { knownBug } from "../helpers/known-bug";
import {
  admin,
  anon,
  expectDenied,
  fixtures,
  IDS,
  learner,
  must,
  newAnonClient,
  withPg,
  startFixtureScope,
  finishFixtureScope,
  fixtureScope,
  ownedInsert,
} from "./helpers";

const SEED_EMAIL = "learner@devspace.test";
const signUpEmail = () => `signup-${fixtureScope().tag}@devspace.test`;

async function profile(id: string) {
  return must(
    await fixtures
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", id)
      .single(),
  );
}

beforeEach(() => {
  startFixtureScope();
});
afterEach(finishFixtureScope);

describe("profiles", () => {
  it("[P1] anon reads no profiles", async () => {
    expect(must(await fixtures.from("profiles").select("id"))).toHaveLength(3);

    const { data, error } = await anon.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("[P2] a learner reads only their own profile", async () => {
    expect(must(await fixtures.from("profiles").select("id"))).toHaveLength(3);

    const { data, error } = await learner.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: IDS.learner }]);
  });

  it("[P3] an admin reads all three seed profiles", async () => {
    const { data, error } = await admin.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data?.map((row) => row.id).sort()).toEqual(
      [IDS.learner, IDS.admin, IDS.student].sort(),
    );
  });
});

describe("profile_cards", () => {
  it("[P4] anon reads id, full_name, avatar_url and role of all three users", async () => {
    const { data, error } = await anon
      .from("profile_cards")
      .select("id, full_name, avatar_url, role");
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data?.find((row) => row.id === IDS.admin)?.role).toBe("admin");
  });

  it("[P5] anon cannot select email from profile_cards", async () => {
    const { data, error } = await anon.from("profile_cards").select("email");
    expect(data).toBeNull();
    expect(error?.code).toBe("42703"); // undefined_column: the view has no email column
  });

  it("[P6] a learner cannot update through profile_cards", async () => {
    await fixtureScope().acquire("profiles", IDS.learner, ["full_name"], {
      full_name: "Nguyễn Văn Học",
    });
    const { error } = await learner
      .from("profile_cards")
      .update({ full_name: "Hacked" })
      .eq("id", IDS.learner);
    expectDenied(error);
    expect((await profile(IDS.learner)).full_name).toBe("Nguyễn Văn Học");
  });

  it("[P6] a learner cannot insert through profile_cards", async () => {
    const { error } = await ownedInsert(
      "profile_cards",
      { id: randomUUID(), full_name: "Ghost", role: "admin" },
      (ownedValues) => learner.from("profile_cards").insert(ownedValues),
    );
    expectDenied(error);
    expect(must(await fixtures.from("profiles").select("id"))).toHaveLength(3);
  });
});

describe("role changes", () => {
  it("[P7] a learner cannot change their own role to admin", async () => {
    await fixtureScope().acquire("profiles", IDS.learner, ["role"], {
      role: "user",
    });
    const { error } = await learner
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", IDS.learner);
    expectDenied(error);
    expect((await profile(IDS.learner)).role).toBe("user");
  });

  it("[P8] a learner updates no rows of another user's profile", async () => {
    await fixtureScope().acquire("profiles", IDS.student, ["full_name"], {
      full_name: "Lê Minh Học Viên",
    });
    const { data, error } = await learner
      .from("profiles")
      .update({ full_name: "Hacked" })
      .eq("id", IDS.student)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await profile(IDS.student)).full_name).toBe("Lê Minh Học Viên");
  });

  it("[P9] an admin can make the learner an admin and back", async () => {
    await fixtureScope().acquire("profiles", IDS.learner, ["role"], {
      role: "user",
    });
    const promote = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", IDS.learner)
      .select("role");
    expect(promote.error).toBeNull();
    expect(promote.data).toEqual([{ role: "admin" }]);
    expect((await profile(IDS.learner)).role).toBe("admin");

    const demote = await admin
      .from("profiles")
      .update({ role: "user" })
      .eq("id", IDS.learner)
      .select("role");
    expect(demote.error).toBeNull();
    expect(demote.data).toEqual([{ role: "user" }]);
    expect((await profile(IDS.learner)).role).toBe("user");
  });
});

describe("functions", () => {
  // handle_new_user returns trigger, so an API call fails before any privilege check; read the catalog instead.
  it("[P10] anon and authenticated cannot execute handle_new_user", async () => {
    const privileges = await withPg(async (client) => {
      const result = await client.query(
        `select has_function_privilege('anon', 'public.handle_new_user()', 'execute') as anon,
                has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as authenticated`,
      );
      return result.rows[0];
    });
    expect(privileges).toEqual({ anon: false, authenticated: false });
  });

  it("[P11] is_admin is false for a learner and true for an admin", async () => {
    expect(await learner.rpc("is_admin")).toMatchObject({
      data: false,
      error: null,
    });
    expect(await admin.rpc("is_admin")).toMatchObject({
      data: true,
      error: null,
    });
  });

  it("[P12] a sign-up that asks for role admin gets role user", async () => {
    await fixtureScope().reserveAuth(signUpEmail());
    const client = newAnonClient();
    const { data, error } = await client.auth.signUp({
      email: signUpEmail(),
      password: "signup-local-pass-1",
      options: { data: { role: "admin", full_name: "Sign Up Test" } },
    });
    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();

    const created = await profile(data.user!.id);
    expect(created.role).toBe("user");
    expect(created.email).toBe(signUpEmail());
  });

  // Hosted Auth requires 8 characters (BL-P11); config.toml must match, or a local pass proves nothing.
  it("[P13] a sign-up with a 7-character password is refused and creates no user; 8 characters are accepted", async () => {
    await fixtureScope().reserveAuth(signUpEmail());
    const client = newAnonClient();
    const refused = await client.auth.signUp({
      email: signUpEmail(),
      password: "pass-12",
    });
    expect(refused.error?.code).toBe("weak_password");
    const users = await withPg(
      async (pg) =>
        (
          await pg.query("select id from auth.users where email = $1", [
            signUpEmail(),
          ])
        ).rows,
    );
    expect(users).toEqual([]);

    const accepted = await client.auth.signUp({
      email: signUpEmail(),
      password: "pass-123",
    });
    expect(accepted.error).toBeNull();
    expect(accepted.data.user?.id).toBeTruthy();
  });
});

describe("known bugs", () => {
  knownBug(
    "P28",
    "[K3] a learner can change their own profiles.email",
    async (bug) => {
      await fixtureScope().acquire("profiles", IDS.learner, ["email"], {
        email: SEED_EMAIL,
      });
      const before = await profile(IDS.learner);
      expect(before.email).toBe(SEED_EMAIL);

      const { error } = await learner
        .from("profiles")
        .update({ email: "changed@devspace.test" })
        .eq("id", IDS.learner);
      expect([null, "42501"]).toContain(error?.code ?? null);

      const after = await profile(IDS.learner);
      await bug(() => expect(after.email).toBe(SEED_EMAIL));
    },
  );
});
