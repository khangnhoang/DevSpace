// Test plan
// Goal: profiles are readable only by their owner or an admin, the public card exposes no private column,
//   and clients cannot change email/identity or raise their own role.
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: policies and grants on public.profiles and public.profile_cards, prevent_role_escalation,
//   public.is_admin(), public.handle_new_user() (H1, H2-1a, H2-1b), and the SE-U3 client identity guard;
//   Auth's minimum password length (BL-P11).
// Allowed paths: self and admin read profiles; anyone reads profile_cards; admin changes another user's role;
//   permitted profile edits retain email/identity; a new sign-up becomes a plain user; an 8-character password.
// Denied paths: anon reads profiles; a learner reads another profile, writes through profile_cards, changes
//   their own role, or updates another profile; anon and authenticated cannot execute handle_new_user;
//   clients replace email/identity or INSERT/UPSERT profiles; a sign-up with a 7-character password.
// Known bugs: none (legacy P28 [K3] is a denied-write regression for SE-P3).
// Invariants: scoped fields are restored, owned Auth/profile fixtures deleted, SQL data probes rolled back,
//   and the migration probe unconditionally restores/verifies the forward catalog or marks the run unclean.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proveProfileEmailRollback } from "./profile-write-probe";
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
    await fixtures.from("profiles").select("*").eq("id", id).single(),
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

async function disposableAccount(label: string) {
  const email = `${label}-${fixtureScope().tag}@devspace.test`;
  await fixtureScope().reserveAuth(email);
  const client = newAnonClient();
  const result = await client.auth.signUp({
    email,
    password: "signup-local-pass-1",
    options: { data: { role: "admin" } },
  });
  expect(result.error).toBeNull();
  expect(result.data.user?.id).toBeTruthy();
  const id = result.data.user!.id;
  expect(await fixtureScope().authIds(email)).toEqual([id]);
  expect(await profile(id)).toMatchObject({ email, role: "user" });
  return { client, id, email };
}

describe("client profile identity (SE-P3)", () => {
  it.each([
    ["learner", learner, IDS.learner, SEED_EMAIL],
    ["admin", admin, IDS.admin, "admin@devspace.test"],
  ] as const)(
    "[K3] %s cannot replace email, including null and mixed-field retries",
    async (_name, actor, id, email) => {
      await fixtureScope().acquire("profiles", id, ["email", "full_name"]);
      const before = await profile(id);
      expect(before.email).toBe(email);
      for (const replacement of ["changed@devspace.test", null]) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const { error } = await actor
            .from("profiles")
            .update({ email: replacement, full_name: "must not persist" })
            .eq("id", id);
          expectDenied(error);
          expect(await profile(id)).toEqual(before);
        }
      }
      // Trusted maintenance can still set NULL; null-safe comparison must reject a later client replacement.
      must(
        await fixtures.from("profiles").update({ email: null }).eq("id", id),
      );
      const withNull = await profile(id);
      const { error } = await actor
        .from("profiles")
        .update({ email, full_name: "must not persist" })
        .eq("id", id);
      expectDenied(error);
      expect(await profile(id)).toEqual(withNull);
      expect(
        (
          await actor
            .from("profiles")
            .update({ email: null, full_name: "same-null allowed" })
            .eq("id", id)
        ).error,
      ).toBeNull();
      expect(await profile(id)).toEqual({
        ...withNull,
        full_name: "same-null allowed",
      });
    },
  );

  it.each([
    ["learner", learner],
    ["admin", admin],
  ] as const)(
    "[P14] %s can save permitted fields with unchanged email and id",
    async (_name, actor) => {
      const fields = ["full_name", "avatar_url", "gender", "dob", "province"];
      await fixtureScope().acquire("profiles", IDS.learner, fields);
      const before = await profile(IDS.learner);
      const changes = {
        full_name: "Allowed name",
        avatar_url: null,
        gender: "female",
        dob: "2000-01-31",
        province: "Hà Nội",
      };
      const { error } = await actor
        .from("profiles")
        .update({ ...changes, email: before.email, id: before.id })
        .eq("id", IDS.learner);
      expect(error).toBeNull();
      expect(await profile(IDS.learner)).toEqual({ ...before, ...changes });
    },
  );

  it("[P15] an admin cannot replace another user's email with a name/avatar/role update", async () => {
    await fixtureScope().acquire("profiles", IDS.learner, [
      "email",
      "full_name",
      "avatar_url",
      "role",
    ]);
    const before = await profile(IDS.learner);
    const { error } = await admin
      .from("profiles")
      .update({
        email: "forged@devspace.test",
        full_name: "forged",
        avatar_url: "forged",
        role: "admin",
      })
      .eq("id", IDS.learner);
    expectDenied(error);
    expect(await profile(IDS.learner)).toEqual(before);
  });

  it.each(["owner", "admin", "anon"] as const)(
    "[P16] %s cannot INSERT or UPSERT a recreated profile with a chosen email",
    async (name) => {
      const account = await disposableAccount(`recreate-${name}`);
      const actor =
        name === "owner" ? account.client : name === "admin" ? admin : anon;
      // Only this scope's disposable profile is removed; the Auth identity must still exist.
      must(await fixtures.from("profiles").delete().eq("id", account.id));
      await fixtureScope().reserve("profiles", { id: account.id });
      const values = {
        id: account.id,
        email: "forged@devspace.test",
        role: "user",
      };
      for (const method of ["insert", "upsert"] as const) {
        expectDenied((await actor.from("profiles")[method](values)).error);
        expect(
          must(
            await fixtures.from("profiles").select("*").eq("id", account.id),
          ),
        ).toEqual([]);
        expect(await fixtureScope().authIds(account.email)).toEqual([
          account.id,
        ]);
      }
    },
  );

  it.each([
    ["learner", learner],
    ["admin", admin],
  ] as const)(
    "[P17] %s cannot use the UPSERT conflict-update branch",
    async (_name, actor) => {
      await fixtureScope().acquire("profiles", IDS.learner, [
        "email",
        "full_name",
      ]);
      const before = await profile(IDS.learner);
      expectDenied(
        (
          await actor.from("profiles").upsert({
            id: IDS.learner,
            email: "forged@devspace.test",
            full_name: "must not persist",
          })
        ).error,
      );
      expect(await profile(IDS.learner)).toEqual(before);
    },
  );

  it.each(["owner", "admin"] as const)(
    "[P18] %s cannot reassign a profile to another existing Auth identity",
    async (name) => {
      const source = await disposableAccount(`source-${name}`);
      const target = await disposableAccount(`target-${name}`);
      const actor = name === "owner" ? source.client : admin;
      must(await fixtures.from("profiles").delete().eq("id", target.id));
      await fixtureScope().reserve("profiles", { id: target.id });
      const before = await profile(source.id);
      expectDenied(
        (
          await actor
            .from("profiles")
            .update({ id: target.id, full_name: "must not persist" })
            .eq("id", source.id)
        ).error,
      );
      expect(await profile(source.id)).toEqual(before);
      expect(
        must(await fixtures.from("profiles").select("id").eq("id", target.id)),
      ).toEqual([]);
      expect(await fixtureScope().authIds(target.email)).toEqual([target.id]);
    },
  );

  it(
    "[P19] M1 rollback/reapply restores exact profile catalogs and preserves H1",
    proveProfileEmailRollback,
    60_000,
  );
});
