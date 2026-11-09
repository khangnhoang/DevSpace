// Test plan
// Goal: the session cache of the API holds only what AC6 allows: positive results, for at most the TTL, never past the
//   token's own expiry, keyed by a hash of the token, in a bounded structure.
// Layer: unit (pure class with an injected clock; the live behavior is in __tests__/api/session.test.ts).
// Subject: AC6 of the TM-U3 plan; ADR 0008 D6.
import { describe, expect, it } from "vitest";
import { SessionCache } from "../../backend/src/auth/session-cache";
import { tokenKey } from "../../backend/src/auth/token";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const user = { id: "00000000-0000-0000-0000-000000000001" };

describe("SessionCache (AC6)", () => {
  it("returns a stored user until the TTL ends and not after", () => {
    const time = clock();
    const cache = new SessionCache(30_000, 10, time.now);
    cache.set("k", user, time.now() + 3_600_000);
    time.advance(29_999);
    expect(cache.get("k")).toEqual(user);
    time.advance(1);
    expect(cache.get("k")).toBeUndefined();
    expect(cache.size, "an expired entry is dropped when it is read").toBe(0);
  });

  it("never outlives the token's own expiry, even inside the TTL", () => {
    const time = clock();
    const cache = new SessionCache(30_000, 10, time.now);
    cache.set("k", user, time.now() + 5_000);
    time.advance(4_999);
    expect(cache.get("k")).toEqual(user);
    time.advance(1);
    expect(cache.get("k")).toBeUndefined();
  });

  it("stores nothing for a token that has already expired", () => {
    const time = clock();
    const cache = new SessionCache(30_000, 10, time.now);
    cache.set("k", user, time.now());
    expect(cache.size).toBe(0);
    expect(cache.get("k")).toBeUndefined();
  });

  it("stays within its bound: expired entries go first, then the oldest", () => {
    const time = clock();
    const cache = new SessionCache(30_000, 3, time.now);
    cache.set("a", user, time.now() + 3_600_000);
    cache.set("b", user, time.now() + 3_600_000);
    cache.set("c", user, time.now() + 3_600_000);
    cache.set("d", user, time.now() + 3_600_000);
    expect(cache.size).toBe(3);
    expect(cache.get("a"), "the oldest entry made room").toBeUndefined();
    expect(cache.get("d")).toEqual(user);

    time.advance(30_000);
    cache.set("e", user, time.now() + 3_600_000);
    expect(cache.size, "all three older entries had expired").toBe(1);

    for (let index = 0; index < 50; index += 1) {
      cache.set(`k${index}`, user, time.now() + 3_600_000);
      expect(cache.size).toBeLessThanOrEqual(3);
    }
  });
});

describe("SessionCache keys (AC6)", () => {
  // The map is private; reading it is the only way to see what a key looks like.
  const keysOf = (cache: SessionCache) => [
    ...(cache as unknown as { entries: Map<string, unknown> }).entries.keys(),
  ];

  it("keys every entry by a hash of the token and never stores the token", () => {
    const time = clock();
    const cache = new SessionCache(30_000, 10, time.now);
    const token = "aaa.bbb.ccc";
    cache.set(token, user, time.now() + 3_600_000);
    expect(keysOf(cache)).toEqual([tokenKey(token)]);
    expect(keysOf(cache)[0]).not.toContain(token);
    expect(cache.get(token)).toEqual(user);
    expect(cache.get("other.token.here")).toBeUndefined();
  });
});

describe("tokenKey (AC6)", () => {
  it("is a SHA-256 hex digest that does not contain the token", () => {
    const token = "aaa.bbb.ccc";
    const key = tokenKey(token);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(token);
    expect(tokenKey(token)).toBe(key);
    expect(tokenKey(`${token}x`)).not.toBe(key);
  });
});
