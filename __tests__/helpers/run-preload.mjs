import { inheritedRun, joinRun, assertRun } from './run-ownership.mjs';
import { isMainThread } from 'node:worker_threads';

// NODE_OPTIONS propagates to Node descendants (including Next workers). Registration precedes application
// execution. A late descendant refuses to start once its coordinator is dead or its run is closed.
if (isMainThread) {
  const ref = inheritedRun();
  joinRun(ref);
  const watch = setInterval(() => {
    try { assertRun(ref); }
    catch { process.exit(1); }
  }, 250);
  watch.unref();
}
