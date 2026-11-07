import {
  runCleanupHook,
  type HookContext,
  type RunMarker,
} from "./fixture-ownership";

// Ownership of Storage objects a test may create, with the same run-state rules as FixtureScope: a name is recorded
// before its request, a run already marked unclean admits no new writer, and a failed cleanup, a failed verification
// or a timed-out test marks the run, so the next scope in any process refuses (test-quality-strategy, Test data).
export class OwnedObjects {
  private readonly names = new Set<string>();
  constructor(
    private readonly options: {
      run: RunMarker;
      remove(name: string): Promise<void>;
      exists(name: string): Promise<boolean>;
    },
  ) {}

  // Call before the first request that could write the name.
  own(name: string): string {
    const cause = this.options.run.check();
    if (cause)
      throw new Error(
        `Previous fixture cleanup is unresolved or the run is unclean (${cause}); no new Storage writer may start`,
      );
    this.names.add(name);
    return name;
  }

  // Each recorded name is removed and verified absent on its own, so one failure never hides another object.
  // The hook context is required: its signal marks the run when the cleanup hook itself times out (QE-P8).
  cleanup(context: HookContext) {
    return runCleanupHook(context, this.options.run, () => this.removeAll());
  }

  private async removeAll() {
    const { run, remove, exists } = this.options;
    const names = [...this.names];
    this.names.clear();
    const unresolved: string[] = [];
    for (const name of names) {
      try {
        await remove(name);
        if (await exists(name)) unresolved.push(`${name} (still present)`);
      } catch (error) {
        unresolved.push(
          `${name} (${error instanceof Error ? error.message : String(error)})`,
        );
      }
    }
    if (unresolved.length) {
      const message = `Storage cleanup unresolved: ${unresolved.join("; ")}`;
      run.mark(message);
      throw new Error(message);
    }
  }
}
