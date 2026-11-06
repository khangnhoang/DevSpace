// Test plan
// Goal: a signed-in non-admin writes `avatars` objects only under their own user-id folder; an admin writes any path.
// Layer: rls (local Supabase Storage API as each actor), plus local SQL catalog and exact-name read-back probes.
// Subject: security-engineering SE-P5, the `avatars` INSERT and UPDATE policies on storage.objects (upload, upsert, move).
// Allowed paths: owner upload/upsert/move inside `<own id>/`; admin upload/overwrite anywhere; public read.
// Denied paths: anon upload; non-admin upload to another user's folder or a flat path; move into another folder or to a
//   flat name; overwrite or move of an object another actor owns, even inside the caller's folder.
// Known bugs: none.
// Invariants: every object a test may create is recorded by exact name before the request (a move records source and
//   destination), removed in afterEach and verified absent by exact name; a failed cleanup or a timeout marks the run unclean and
//   a marked run admits no further writer (OwnedObjects, unit-tested in storage-object-scope.test.ts).
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type pg from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { sharedRunMarker } from "../helpers/fixture-ownership";
import { OwnedObjects } from "../helpers/storage-object-scope";
import {
  admin,
  anon,
  fixtures,
  IDS,
  learner,
  student,
  withPg,
} from "./helpers";

// A valid 1x1 PNG, and the same bytes with one trailing byte so an overwrite is observable.
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const PNG2 = Uint8Array.from([...PNG, 0]);
const png = (bytes: Uint8Array) =>
  new Blob([new Uint8Array(bytes)], { type: "image/png" });
const bucket = (client: typeof admin) => client.storage.from("avatars");

const MARKER = `rls-test-${randomUUID()}`;
let counter = 0;
const objects = new OwnedObjects({
  run: sharedRunMarker(),
  remove: async (name) => {
    const { error } = await fixtures.storage.from("avatars").remove([name]);
    if (error) throw new Error(error.message);
  },
  exists: async (name) => (await objectRow(name)).length > 0,
});
// Names are unique per run and recorded before any request, so cleanup never depends on a shared pattern.
function owned(folder?: string): string {
  const name = `${folder ? `${folder}/` : ""}${MARKER}-${counter++}.png`;
  return objects.own(name);
}

async function objectRow(name: string) {
  return withPg(
    async (client) =>
      (
        await client.query(
          "select name, owner::text as owner, metadata->>'size' as size from storage.objects where bucket_id = 'avatars' and name = $1",
          [name],
        )
      ).rows,
  );
}
async function expectAbsent(name: string) {
  expect(await objectRow(name), `object ${name} must not exist`).toEqual([]);
}
async function expectDeniedUpload(
  error: { message?: string; statusCode?: string } | null,
) {
  expect(error, "the request should have been denied").not.toBeNull();
  expect(String(error?.message)).toMatch(
    /row-level security|violates|unauthorized/i,
  );
}

afterEach((context) => objects.cleanup(context));

describe("avatar uploads", () => {
  it("[S1] a learner uploads into their own folder", async () => {
    const name = owned(IDS.learner);
    const { error } = await bucket(learner).upload(name, png(PNG), {
      contentType: "image/png",
    });
    expect(error).toBeNull();
    expect(await objectRow(name)).toMatchObject([{ name, owner: IDS.learner }]);
  });

  it("[S2] a learner cannot upload into the student's folder, a flat path or a lookalike folder", async () => {
    const paths = [
      owned(IDS.student),
      owned(),
      owned(`${IDS.student}/${IDS.learner}`),
      owned(`${IDS.learner}x`),
      owned(`x/${IDS.learner}`),
    ];
    for (const name of paths) {
      const { error } = await bucket(learner).upload(name, png(PNG), {
        contentType: "image/png",
      });
      await expectDeniedUpload(error);
      await expectAbsent(name);
    }
  });

  it("[S3] an admin uploads a flat path and into another user's folder", async () => {
    for (const name of [owned(), owned(IDS.learner)]) {
      const { error } = await bucket(admin).upload(name, png(PNG), {
        contentType: "image/png",
      });
      expect(error).toBeNull();
      expect(await objectRow(name)).toMatchObject([{ name, owner: IDS.admin }]);
    }
  });

  it("[S4] anon cannot upload anywhere", async () => {
    for (const name of [owned(), owned(IDS.learner)]) {
      const { error } = await bucket(anon).upload(name, png(PNG), {
        contentType: "image/png",
      });
      await expectDeniedUpload(error);
      await expectAbsent(name);
    }
  });
});

describe("avatar update and move", () => {
  it("[S5] the owner overwrites their own object (upsert) inside their folder", async () => {
    const name = owned(IDS.learner);
    expect(
      (
        await bucket(learner).upload(name, png(PNG), {
          contentType: "image/png",
        })
      ).error,
    ).toBeNull();
    const second = await bucket(learner).upload(name, png(PNG2), {
      contentType: "image/png",
      upsert: true,
    });
    expect(second.error).toBeNull();
    expect(await objectRow(name)).toMatchObject([
      { name, owner: IDS.learner, size: String(PNG2.length) },
    ]);
  });

  it("[S6] the owner renames an own object inside their folder", async () => {
    const source = owned(IDS.learner);
    const destination = owned(IDS.learner);
    expect(
      (
        await bucket(learner).upload(source, png(PNG), {
          contentType: "image/png",
        })
      ).error,
    ).toBeNull();
    const { error } = await bucket(learner).move(source, destination);
    expect(error).toBeNull();
    await expectAbsent(source);
    expect(await objectRow(destination)).toMatchObject([
      { name: destination, owner: IDS.learner },
    ]);
  });

  it("[S7] the owner cannot move an own object into another user's folder or to a flat name", async () => {
    const source = owned(IDS.learner);
    expect(
      (
        await bucket(learner).upload(source, png(PNG), {
          contentType: "image/png",
        })
      ).error,
    ).toBeNull();
    for (const destination of [owned(IDS.student), owned()]) {
      const { error } = await bucket(learner).move(source, destination);
      expect(error, `move to ${destination} should be refused`).not.toBeNull();
      await expectAbsent(destination);
      expect(await objectRow(source)).toMatchObject([
        { name: source, owner: IDS.learner },
      ]);
    }
  });

  it("[S8] a non-admin cannot overwrite or move an object another actor owns, even inside their own folder", async () => {
    const name = owned(IDS.learner);
    const destination = owned(IDS.learner);
    expect(
      (await bucket(admin).upload(name, png(PNG), { contentType: "image/png" }))
        .error,
    ).toBeNull();
    const overwrite = await bucket(learner).upload(name, png(PNG2), {
      contentType: "image/png",
      upsert: true,
    });
    await expectDeniedUpload(overwrite.error);
    const move = await bucket(learner).move(name, destination);
    expect(move.error).not.toBeNull();
    await expectAbsent(destination);
    expect(await objectRow(name)).toMatchObject([
      { name, owner: IDS.admin, size: String(PNG.length) },
    ]);
  });

  it("[S9] a student cannot overwrite the learner's own object", async () => {
    const name = owned(IDS.learner);
    expect(
      (
        await bucket(learner).upload(name, png(PNG), {
          contentType: "image/png",
        })
      ).error,
    ).toBeNull();
    const { error } = await bucket(student).upload(name, png(PNG2), {
      contentType: "image/png",
      upsert: true,
    });
    await expectDeniedUpload(error);
    expect(await objectRow(name)).toMatchObject([
      { name, owner: IDS.learner, size: String(PNG.length) },
    ]);
  });

  it("[S10] an admin overwrites and moves another user's object", async () => {
    const source = owned(IDS.learner);
    const destination = owned();
    expect(
      (
        await bucket(learner).upload(source, png(PNG), {
          contentType: "image/png",
        })
      ).error,
    ).toBeNull();
    const overwrite = await bucket(admin).upload(source, png(PNG2), {
      contentType: "image/png",
      upsert: true,
    });
    expect(overwrite.error).toBeNull();
    expect(await objectRow(source)).toMatchObject([
      { name: source, size: String(PNG2.length) },
    ]);
    const move = await bucket(admin).move(source, destination);
    expect(move.error).toBeNull();
    await expectAbsent(source);
    expect(await objectRow(destination)).toHaveLength(1);
  });
});

describe("avatar read and catalog", () => {
  it("[S11] public read of an object still works for anon, by API and by public URL", async () => {
    const name = owned(IDS.learner);
    expect(
      (
        await bucket(learner).upload(name, png(PNG), {
          contentType: "image/png",
        })
      ).error,
    ).toBeNull();
    const downloaded = await bucket(anon).download(name);
    expect(downloaded.error).toBeNull();
    expect(downloaded.data?.size).toBe(PNG.length);
    const response = await fetch(
      bucket(anon).getPublicUrl(name).data.publicUrl,
    );
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(PNG.length);
  });

  it("[S12] avatars carry exactly the public SELECT policy and the two ownership policies on write", async () => {
    await withPg(async (client) => {
      expect(await avatarCatalog(client)).toEqual(forwardAvatarPolicies);
    });
  });

  it("[S13] the rollback restores the two original avatars policies exactly and the migration reapplies", async () => {
    const name = "20261106175756_se_u4_avatar_path_ownership";
    const read = async (dir: string, file: string) =>
      (
        await readFile(
          new URL(`../../supabase/${dir}/${file}`, import.meta.url),
          "utf8",
        )
      )
        .replace(/^begin;$/m, "")
        .replace(/^commit;$/m, "");
    const up = await read("migrations", `${name}.sql`);
    const down = await read("rollbacks", `${name}.down.sql`);
    await withPg(async (client) => {
      await client.query("begin");
      try {
        await client.query(down);
        expect(await avatarCatalog(client)).toEqual(previousAvatarPolicies);
        await client.query(up);
        expect(await avatarCatalog(client)).toEqual(forwardAvatarPolicies);
      } finally {
        await client.query("rollback");
      }
    });
    await withPg(async (client) =>
      expect(await avatarCatalog(client)).toEqual(forwardAvatarPolicies),
    );
  });
});

const avatarCatalog = async (client: pg.Client) =>
  (
    await client.query(`select policyname, cmd, roles::text as roles,
        regexp_replace(coalesce(qual, ''), '[[:space:]]+', ' ', 'g') as qual,
        regexp_replace(coalesce(with_check, ''), '[[:space:]]+', ' ', 'g') as with_check
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) like '%avatars%'
      order by policyname`)
  ).rows;

const forwardAvatarPolicies = [
  {
    policyname: "Avatar xem cong khai",
    cmd: "SELECT",
    roles: "{public}",
    qual: "(bucket_id = 'avatars'::text)",
    with_check: "",
  },
  {
    policyname: "avatars_insert_own_folder_or_admin",
    cmd: "INSERT",
    roles: "{public}",
    qual: "",
    with_check:
      "((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR is_admin()))",
  },
  {
    policyname: "avatars_update_own_folder_or_admin",
    cmd: "UPDATE",
    roles: "{public}",
    qual: "((bucket_id = 'avatars'::text) AND (((owner = ( SELECT auth.uid() AS uid)) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)) OR is_admin()))",
    with_check:
      "((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR is_admin()))",
  },
];

const previousAvatarPolicies = [
  {
    policyname: "Avatar xem cong khai",
    cmd: "SELECT",
    roles: "{public}",
    qual: "(bucket_id = 'avatars'::text)",
    with_check: "",
  },
  {
    policyname: "User tu sua avatar",
    cmd: "UPDATE",
    roles: "{public}",
    qual: "((bucket_id = 'avatars'::text) AND (auth.uid() = owner))",
    with_check: "",
  },
  {
    policyname: "User tu upload avatar",
    cmd: "INSERT",
    roles: "{public}",
    qual: "",
    with_check:
      "((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text))",
  },
];
