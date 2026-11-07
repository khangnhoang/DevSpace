"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- a `node --require` preload is CommonJS */
// Preloaded into the e2e `next start` process only (`--require`, scripts/e2e/serve.mjs). `next build` runs without
// it because the build downloads the Google font. It does two jobs:
// 1. Network guard: the process can neither resolve a name nor open a TCP connection for any host but
//    127.0.0.1, localhost or ::1. A refusal fails the call and is appended to E2E_GUARD_FILE, which fixtures.ts
//    reads, so a test during which the server tried to reach out fails. nodemailer resolves its SMTP host with
//    `dns.Resolver` before it opens a socket, so name resolution is refused too, not only the connection.
// 2. Mail record: when E2E_MAIL_FILE is set, `sendMail` of every nodemailer transport appends the recipient and
//    subject to that file and sends nothing (server-mail.cjs says how it reaches the bundled nodemailer).
const dns = require("node:dns");
const fs = require("node:fs");
const net = require("node:net");

const guardFile = process.env.E2E_GUARD_FILE;
if (!guardFile)
  throw new Error(
    "server-guard: E2E_GUARD_FILE is not set, so a refusal could not be recorded",
  );
const mailFile = process.env.E2E_MAIL_FILE;

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

function isLoopback(host) {
  return (
    typeof host === "string" &&
    LOOPBACK.has(host.toLowerCase().replace(/^\[|\]$/g, ""))
  );
}

function refuse(kind, host, port) {
  const name = String(host);
  fs.appendFileSync(
    guardFile,
    `${JSON.stringify({ kind, host: name, port: port ?? null, time: Date.now() })}\n`,
  );
  const error = new Error(
    `e2e server guard refused ${kind === "dns" ? "to resolve" : "to connect to"} ${name}`,
  );
  error.code = "E2E_GUARD";
  return error;
}

// An IP literal needs no query; its connection is refused below.
const mustRefuseName = (host) =>
  Boolean(host) && !isLoopback(host) && net.isIP(String(host)) === 0;

const realLookup = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  const done = typeof options === "function" ? options : callback;
  if (mustRefuseName(hostname) && typeof done === "function") {
    const error = refuse("dns", hostname);
    process.nextTick(done, error);
    return {};
  }
  return realLookup.apply(this, arguments);
};

const realPromiseLookup = dns.promises.lookup;
dns.promises.lookup = async function lookup(hostname) {
  if (mustRefuseName(hostname)) throw refuse("dns", hostname);
  return realPromiseLookup.apply(this, arguments);
};

const RESOLVE_METHODS = [
  "resolve",
  "resolve4",
  "resolve6",
  "resolveAny",
  "resolveCaa",
  "resolveCname",
  "resolveMx",
  "resolveNaptr",
  "resolveNs",
  "resolvePtr",
  "resolveSoa",
  "resolveSrv",
  "resolveTxt",
  "reverse",
];

function guardResolveMethods(target, returnsPromise) {
  for (const name of RESOLVE_METHODS) {
    const real = target[name];
    if (typeof real !== "function") continue;
    target[name] = function guarded(host, ...rest) {
      if (isLoopback(host)) return real.call(this, host, ...rest);
      const error = refuse("dns", host);
      if (returnsPromise) return Promise.reject(error);
      const callback = rest[rest.length - 1];
      if (typeof callback !== "function") throw error;
      process.nextTick(callback, error);
      return undefined;
    };
  }
}
guardResolveMethods(dns, false);
guardResolveMethods(dns.Resolver.prototype, false);
guardResolveMethods(dns.promises, true);
guardResolveMethods(dns.promises.Resolver.prototype, true);

// Mirrors the argument forms of net.Socket.prototype.connect: (options), (port[, host]), (path), and the
// already normalized `[options, callback]` array that net.connect passes on.
function connectTarget(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first !== null && typeof first === "object") {
    if (first.path) return null;
    return { host: first.host ?? "localhost", port: first.port };
  }
  if (typeof first === "string" && Number.isNaN(Number(first))) return null;
  return {
    host: typeof args[1] === "string" ? args[1] : "localhost",
    port: first,
  };
}

const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function connect(...args) {
  const target = connectTarget(args);
  if (target && !isLoopback(target.host)) {
    const error = refuse("connect", target.host, target.port);
    process.nextTick(() => this.destroy(error));
    return this;
  }
  return realConnect.apply(this, args);
};

if (mailFile) require("./server-mail.cjs").installMailRecord(mailFile);

// 3. Auth record: when E2E_AUTH_FILE is set, the server's refresh and token-check calls to Auth are recorded with their
// status (server-auth-record.cjs). It observes only; it blocks and changes nothing.
const authFile = process.env.E2E_AUTH_FILE;
if (authFile) require("./server-auth-record.cjs").installAuthRecord(authFile);
