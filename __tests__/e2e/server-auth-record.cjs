"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- loaded by the `node --require` preload, which is CommonJS */
// Loaded by server-guard.cjs when E2E_AUTH_FILE is set (the e2e `next start` process only). It records which calls the
// server sends to Auth for a session: the refresh (`/auth/v1/token?grant_type=refresh_token`, which the proxy's
// `getUser()` sends when an access token is about to expire) and the token check (`/auth/v1/user`), each with its HTTP
// status and a time. QE-P7 needs to know whether the server refreshed a session, which the browser never sees. It
// records nothing else: no URL query, header, cookie or body (QE-U5 G4), and it neither blocks nor changes a request.
const fs = require("node:fs");

function kindOf(href) {
  const url = URL.parse(href);
  if (!url) return null;
  if (
    url.pathname.endsWith("/auth/v1/token") &&
    url.searchParams.get("grant_type") === "refresh_token"
  )
    return "refresh";
  if (url.pathname.endsWith("/auth/v1/user")) return "user";
  return null;
}

function hrefOf(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input && typeof input.url === "string" ? input.url : "";
}

function installAuthRecord(file) {
  const realFetch = globalThis.fetch;
  const append = (kind, status, started) =>
    fs.appendFileSync(
      file,
      `${JSON.stringify({ kind, status, time: started, durationMs: Date.now() - started })}\n`,
    );
  globalThis.fetch = async function fetch(input, init) {
    const kind = kindOf(hrefOf(input));
    if (!kind) return realFetch.call(this, input, init);
    const started = Date.now();
    try {
      const response = await realFetch.call(this, input, init);
      append(kind, response.status, started);
      return response;
    } catch (error) {
      append(kind, "error", started);
      throw error;
    }
  };
}

module.exports = { installAuthRecord, kindOf };
