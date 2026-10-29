import { inheritedRun, joinRun, assertRun, recordEntry, forgetEntry } from './run-ownership.mjs';
import { isMainThread } from 'node:worker_threads';
import { Server } from 'node:http';

// NODE_OPTIONS propagates to Node descendants (including Next workers). Registration precedes application
// execution. A late descendant refuses to start once its coordinator is dead or its run is closed.
if (isMainThread) {
  const ref = inheritedRun();
  joinRun(ref);
  const emit = Server.prototype.emit;
  Server.prototype.emit = function (event, ...args) {
    if (event === 'request' && args[0].method === 'POST') {
      const id = recordEntry(ref, { kind: 'http', pid: process.pid, scope: 'server' });
      args[1].once('finish', () => forgetEntry(ref, id));
    }
    return emit.call(this, event, ...args);
  };
  const rawFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
    const url = new URL(input?.url ?? String(input));
    if (['GET', 'HEAD'].includes(method) || url.origin.replace('localhost', '127.0.0.1') !== ref.target.api) return rawFetch(input, init);
    const id = recordEntry(ref, { kind: 'request', scope: 'server', pid: process.pid, path: url.pathname });
    const response = await rawFetch(input, init);
    await response.clone().arrayBuffer();
    forgetEntry(ref, id);
    return response;
  };
  const watch = setInterval(() => {
    try { assertRun(ref); }
    catch { process.exit(1); }
  }, 250);
  watch.unref();
}
