// Runs a check at most once per window however many callers arrive, and shares an unfinished run between them.
// Both outcomes are kept for the window: a failing database must not be hammered by a monitor either (AC4).
export class ProbeCache {
  private result: { ok: boolean; at: number } | null = null;
  private inflight: Promise<boolean> | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  run(check: () => Promise<boolean>): Promise<boolean> {
    if (this.result && this.now() - this.result.at < this.windowMs) {
      return Promise.resolve(this.result.ok);
    }
    if (this.inflight) return this.inflight;
    this.inflight = check()
      .catch(() => false)
      .then((ok) => {
        this.result = { ok, at: this.now() };
        this.inflight = null;
        return ok;
      });
    return this.inflight;
  }
}
