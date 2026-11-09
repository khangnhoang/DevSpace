import { tokenKey } from "./token";

export type CachedUser = { id: string };

// Positive session checks only, keyed by a hash of the token that the cache itself computes (the token is never stored), for at most `ttlMs` and never past
// the token's own expiry. The map is bounded: when it is full, expired entries go first and then the oldest.
export class SessionCache {
  private readonly entries = new Map<
    string,
    { user: CachedUser; until: number }
  >();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(token: string): CachedUser | undefined {
    const key = tokenKey(token);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.until <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.user;
  }

  set(token: string, user: CachedUser, tokenExpiresAtMs: number): void {
    const until = Math.min(this.now() + this.ttlMs, tokenExpiresAtMs);
    if (until <= this.now()) return;
    const key = tokenKey(token);
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.evict();
    this.entries.set(key, { user, until });
  }

  get size(): number {
    return this.entries.size;
  }

  private evict(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.until <= now) this.entries.delete(key);
    }
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.entries.delete(oldest.value);
    }
  }
}
