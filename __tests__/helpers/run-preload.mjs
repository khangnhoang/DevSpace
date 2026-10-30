import { inheritedRun, joinRun, assertRun, recordEntry, forgetEntry, admitHttp, inspectRun } from './run-ownership.mjs';
import { isMainThread } from 'node:worker_threads';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Server } from 'node:http';

// Registration precedes application code in every inherited Node process. Request listeners in Next's
// start-server await requestHandler; its promise, rather than a client socket event, owns side-effect lifetime.
if (isMainThread) {
  const ref = inheritedRun();
  joinRun(ref);
  const needsScope = inspectRun(ref).owner.mode !== 'dev';
  const requests = new AsyncLocalStorage();
  const on = Server.prototype.on;
  Server.prototype.on = function (event, listener) {
    if (event !== 'request') return on.call(this, event, listener);
    return on.call(this, event, function (request, response) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return listener.call(this, request, response);
      const scope = needsScope ? request.headers['x-devspace-fixture-scope'] : 'dev';
      let id;
      try { id = needsScope ? admitHttp(ref, scope) : recordEntry(ref, { kind: 'http', scope, pid: process.pid }); }
      catch (error) {
        console.error(`fixture HTTP admission failed: ${error.message}`);
        response.writeHead(409); response.end('Fixture scope is closed or absent');
        return;
      }
      let ended = false;
      const finish = () => { if (!ended) { forgetEntry(ref, id); ended = true; } };
      return requests.run({ id, scope }, () => {
        try {
          const result = listener.call(this, request, response);
          if (result && typeof result.finally === 'function') return result.finally(finish);
          // A synchronous listener has no promise proving completion of asynchronous work. Keep its marker
          // until finish; a premature close stays unresolved. Late fetches retain this async context below.
          response.once('finish', finish);
          if (response.writableFinished) finish();
          return result;
        } catch (error) { finish(); throw error; }
      });
    });
  };
  const rawFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
    const url = new URL(input?.url ?? String(input));
    if (['GET', 'HEAD'].includes(method) || url.origin.replace('localhost', '127.0.0.1') !== ref.target.api) return rawFetch(input, init);
    const parent = requests.getStore();
    if (parent && !inspectRun(ref).entries.some(entry => entry.id === parent.id)) throw new Error('Request handler ended; refusing a late mutation');
    const id = recordEntry(ref, { kind: 'request', scope: parent?.scope ?? 'server', pid: process.pid, path: url.pathname });
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
