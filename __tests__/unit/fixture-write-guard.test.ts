// Test plan
// Goal: a fixture write that starts after its test timed out never leaves the process (QE-P8, AC1).
// Layer: unit (in-memory run marker, fake fetch; no database, no network).
// Subject: admitted and guardedFetch in __tests__/helpers/fixture-ownership.ts, the checks behind ownedInsert and the actor clients of the rls project.
// Allowed paths: an open run sends inserts, row mutations, RPCs and Storage writes; reads always pass.
// Denied paths: a run marked unclean while operation A was pending refuses operation B of the same test, for each kind of write.
// Known bugs: none.
// Invariants: the refused request never reaches fetch, so nothing is written; cleanup and read-back are not gated here.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  admitted,
  FixtureScope,
  guardedFetch,
  noteTimeout,
  type RunMarker,
} from "../helpers/fixture-ownership";

const marker = () => {
  const causes: string[] = [];
  return {
    causes,
    check: () => causes[0] ?? null,
    mark: (cause: string) => {
      causes.push(cause);
    },
  } satisfies RunMarker & { causes: string[] };
};

const reply = () =>
  new Response("[]", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
function actor(run: RunMarker) {
  const sent: string[] = [];
  const base = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(
      `${init?.method ?? "GET"} ${new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname}`,
    );
    return reply();
  }) as typeof fetch;
  const client = createClient("http://127.0.0.1:1", "anon-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: guardedFetch(() => run, base) },
  });
  return { client, sent };
}

// Operation A is held pending, the test is marked timed out, then A resumes and the same test tries B.
async function heldThenResumed(run: RunMarker, second: () => Promise<unknown>) {
  let release!: () => void;
  const first = new Promise<void>((resolve) => {
    release = resolve;
  });
  const body = (async () => {
    await first;
    return second();
  })();
  noteTimeout("slow test", run);
  release();
  return body;
}

describe("admitted", () => {
  it("runs the request callback of an insert only while the run is clean, and never after the test timed out", async () => {
    const db = {
      from: () => ({
        select: () => ({ match: async () => ({ data: [], error: null }) }),
      }),
    } as never;
    const run = marker();
    const scope = new FixtureScope(db, "unused", { run });
    let calls = 0;
    // The way ownedInsert does it: reserve first, admit last.
    const insert = async () => {
      await scope.reserve("notifications", { title: "owned" });
      return admitted(scope.run, async () => {
        calls++;
      });
    };
    await insert();
    expect(calls).toBe(1);
    await expect(
      heldThenResumed(run, async () => {
        await scope.reserve("notifications", { title: "owned 2" });
        return admitted(scope.run, async () => {
          calls++;
        });
      }),
    ).rejects.toThrow("no further fixture write is admitted");
    expect(calls).toBe(1);
    expect(run.causes).toEqual(["test timed out: slow test"]);
  });

  it("checks after the last preparatory await: a run marked while the reservation is pending still blocks the callback", async () => {
    const run = marker();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const write = (async () => {
      await gate;
      return admitted(run, async () => {
        calls++;
      });
    })();
    run.mark("residue: elsewhere");
    release();
    await expect(write).rejects.toThrow("residue: elsewhere");
    expect(calls).toBe(0);
  });
});

describe("guardedFetch on an actor client", () => {
  it("sends row mutations, write RPCs and Storage writes on an open run", async () => {
    const run = marker();
    const { client, sent } = actor(run);
    await client
      .from("chapters")
      .update({ title: "x" })
      .eq("id", 1)
      .select("id");
    await client.from("chapters").delete().eq("id", 1).select("id");
    await client.rpc("soft_delete_comment", { comment_id: 1 });
    await client.storage.from("avatars").upload("a.png", new Blob(["x"]));
    await client.storage.from("avatars").move("a.png", "b.png");
    await client.storage.from("avatars").remove(["b.png"]);
    expect(sent).toEqual([
      "PATCH /rest/v1/chapters",
      "DELETE /rest/v1/chapters",
      "POST /rest/v1/rpc/soft_delete_comment",
      "POST /storage/v1/object/avatars/a.png",
      "POST /storage/v1/object/move",
      "DELETE /storage/v1/object/avatars",
    ]);
  });

  it.each([
    [
      "an update on a held row",
      (c: ReturnType<typeof actor>["client"]) =>
        c.from("chapters").update({ title: "x" }).eq("id", 1).select("id"),
    ],
    [
      "a delete on a held row",
      (c: ReturnType<typeof actor>["client"]) =>
        c.from("chapters").delete().eq("id", 1).select("id"),
    ],
    [
      "an insert",
      (c: ReturnType<typeof actor>["client"]) =>
        c.from("chapters").insert({ title: "x" }),
    ],
    [
      "an upsert",
      (c: ReturnType<typeof actor>["client"]) =>
        c
          .from("reviews")
          .upsert({ rating: 1 }, { onConflict: "user_id,course_id" }),
    ],
    [
      "a write RPC",
      (c: ReturnType<typeof actor>["client"]) =>
        c.rpc("soft_delete_comment", { comment_id: 1 }),
    ],
    [
      "a Storage upload",
      (c: ReturnType<typeof actor>["client"]) =>
        c.storage.from("avatars").upload("a.png", new Blob(["x"])),
    ],
    [
      "a Storage upsert",
      (c: ReturnType<typeof actor>["client"]) =>
        c.storage
          .from("avatars")
          .upload("a.png", new Blob(["x"]), { upsert: true }),
    ],
    [
      "a Storage move",
      (c: ReturnType<typeof actor>["client"]) =>
        c.storage.from("avatars").move("a.png", "b.png"),
    ],
    [
      "a Storage remove",
      (c: ReturnType<typeof actor>["client"]) =>
        c.storage.from("avatars").remove(["a.png"]),
    ],
  ])("after the test timed out, %s is never sent", async (_name, write) => {
    const run = marker();
    const { client, sent } = actor(run);
    await client.from("chapters").select("id"); // operation A, a read that went out while the run was clean
    const settled = (await heldThenResumed(run, async () => write(client))) as {
      error: unknown;
    };
    expect(settled.error).toBeTruthy();
    expect(sent).toEqual(["GET /rest/v1/chapters"]);
  });

  it("still sends reads while the run is unclean, so read-back is never blocked", async () => {
    const run = marker();
    run.mark("fixture cleanup failed");
    const { client, sent } = actor(run);
    await client.from("chapters").select("id");
    expect(sent).toEqual(["GET /rest/v1/chapters"]);
  });
});
