import { describe, expect, it } from "vitest";
import { ProbeCache } from "../../backend/src/common/probe-cache";

function deferred() {
  let resolve!: (ok: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("ProbeCache (AC4: at most one probe per window)", () => {
  it("runs one check for any number of concurrent callers and gives them all its answer", async () => {
    let now = 0;
    const cache = new ProbeCache(10_000, () => now);
    const gate = deferred();
    let calls = 0;
    const check = () => {
      calls += 1;
      return gate.promise;
    };
    const callers = Array.from({ length: 25 }, () => cache.run(check));
    gate.resolve(true);
    expect(await Promise.all(callers)).toEqual(Array(25).fill(true));
    expect(calls).toBe(1);
    now = 9_999;
    expect(await cache.run(check)).toBe(true);
    expect(calls).toBe(1);
  });

  it("probes again once the window has passed", async () => {
    let now = 0;
    const cache = new ProbeCache(10_000, () => now);
    let calls = 0;
    const check = async () => {
      calls += 1;
      return true;
    };
    await cache.run(check);
    now = 10_000;
    await cache.run(check);
    expect(calls).toBe(2);
  });

  it("keeps a failure for the window too, and a thrown check counts as false with no detail", async () => {
    let now = 0;
    const cache = new ProbeCache(10_000, () => now);
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error("connect ECONNREFUSED secret-host");
    };
    expect(await cache.run(failing)).toBe(false);
    expect(await cache.run(failing)).toBe(false);
    expect(calls).toBe(1);
    now = 10_000;
    expect(await cache.run(async () => true)).toBe(true);
  });
});
