import { readFile } from "node:fs/promises";
import type pg from "pg";
import { expect, inject } from "vitest";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { sharedRunMarker } from "../helpers/fixture-ownership";
import { fixtureScope, fixtures, must, withPg } from "./helpers";
import { profileCatalog } from "./profile-write-probe";

const migration = "20261106095706_se_u3_profile_role_constraint";
const invalidRoles = [
  null,
  "",
  " ",
  "Admin",
  "USER",
  "Chọn vai trò",
  "moderator",
];

function verifyTarget() {
  requireActiveRun({ command: "npm test" });
  const verified = readTestStack(process.cwd());
  const injected = inject("localStack");
  if (verified.dbUrl !== injected.dbUrl || verified.apiUrl !== injected.apiUrl)
    throw new Error("Role probe target differs from the verified test stack");
}

async function ownedAccount() {
  const email = `role-probe-${fixtureScope().tag}@devspace.test`;
  await fixtureScope().reserveAuth(email);
  const result = await fixtures.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  expect(result.error).toBeNull();
  expect(result.data.user?.id).toBeTruthy();
  const id = result.data.user!.id;
  expect(await fixtureScope().authIds(email)).toEqual([id]);
  expect(
    must(await fixtures.from("profiles").select("role").eq("id", id).single())
      .role,
  ).toBe("user");
  return id;
}

async function savepoint(client: pg.Client, run: () => Promise<void>) {
  await client.query("savepoint role_probe");
  try {
    await run();
  } finally {
    await client.query("rollback to savepoint role_probe");
    await client.query("release savepoint role_probe");
  }
}

export async function proveProfileRoleConstraint() {
  verifyTarget();
  const id = await ownedAccount();
  await withPg(async (client) => {
    await client.query("begin");
    try {
      expect(
        (
          await client.query(
            `select attnotnull from pg_attribute where attrelid='public.profiles'::regclass and attname='role'`,
          )
        ).rows,
      ).toEqual([{ attnotnull: true }]);
      expect(
        (
          await client.query(
            `select convalidated from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_role_allowed'`,
          )
        ).rows,
      ).toEqual([{ convalidated: true }]);
      for (const role of ["user", "admin", ...invalidRoles]) {
        const code = role === null ? "23502" : "23514";
        await savepoint(client, async () => {
          const request = client.query(
            "update public.profiles set role=$1 where id=$2 returning role",
            [role, id],
          );
          if (role === "user" || role === "admin")
            expect((await request).rows).toEqual([{ role }]);
          else await expect(request).rejects.toMatchObject({ code });
        });
        await savepoint(client, async () => {
          await client.query("delete from public.profiles where id=$1", [id]);
          const request = client.query(
            "insert into public.profiles(id,role) values($1,$2) returning role",
            [id, role],
          );
          if (role === "user" || role === "admin")
            expect((await request).rows).toEqual([{ role }]);
          else await expect(request).rejects.toMatchObject({ code });
        });
        expect(
          (
            await client.query("select role from public.profiles where id=$1", [
              id,
            ])
          ).rows,
        ).toEqual([{ role: "user" }]);
      }
      await savepoint(client, async () => {
        await client.query("delete from public.profiles where id=$1", [id]);
        expect(
          (
            await client.query(
              "insert into public.profiles(id) values($1) returning role",
              [id],
            )
          ).rows,
        ).toEqual([{ role: "user" }]);
      });
    } finally {
      await client.query("rollback");
    }
  });
}

export async function proveProfileRoleRollback() {
  verifyTarget();
  const id = await ownedAccount();
  const up = await readFile(
    new URL(`../../supabase/migrations/${migration}.sql`, import.meta.url),
    "utf8",
  );
  const down = await readFile(
    new URL(`../../supabase/rollbacks/${migration}.down.sql`, import.meta.url),
    "utf8",
  );
  const marker = sharedRunMarker();
  await withPg(async (client) => {
    const forward = await profileCatalog(client);
    let originalError: unknown;
    try {
      await client.query(down);
      const previous = await profileCatalog(client);
      expect(previous).toEqual({
        ...forward,
        columns: (forward.columns as { attname: string }[]).map((column) =>
          column.attname === "role" ? { ...column, attnotnull: false } : column,
        ),
        constraints: (forward.constraints as { conname: string }[]).filter(
          (constraint) => constraint.conname !== "profiles_role_allowed",
        ),
      });
      for (const role of [null, "invalid-existing"]) {
        await client.query("update public.profiles set role=$1 where id=$2", [
          role,
          id,
        ]);
        await expect(client.query(up)).rejects.toMatchObject({
          code: "P0001",
          message:
            "SE-U3 invalid existing profile roles; stop for an Owner-approved repair",
        });
        await client.query("rollback");
        expect(await profileCatalog(client)).toEqual(previous);
        expect(
          (
            await client.query("select role from public.profiles where id=$1", [
              id,
            ])
          ).rows,
        ).toEqual([{ role }]);
      }
      await client.query("update public.profiles set role='user' where id=$1", [
        id,
      ]);
      await client.query(up);
      expect(await profileCatalog(client)).toEqual(forward);
    } catch (error) {
      originalError = error;
    } finally {
      try {
        await client.query("rollback");
        // Only the reserved account was changed; settle it before restoring the validated constraint.
        await client.query(
          "update public.profiles set role='user' where id=$1",
          [id],
        );
        const present = (
          await client.query(
            "select exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_role_allowed') as present",
          )
        ).rows[0].present;
        if (!present) await client.query(up);
        expect(await profileCatalog(client)).toEqual(forward);
      } catch (restoration) {
        marker.mark(
          "SE-U3 M2 rollback probe could not restore/verify the forward catalog",
        );
        throw new AggregateError(
          [originalError, restoration].filter(Boolean),
          "M2 rollback probe restoration failed",
        );
      }
    }
    if (originalError) throw originalError;
  });
}
