"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- a `node --require` preload is CommonJS */
// The mail record of the e2e server (loaded by server-guard.cjs when E2E_MAIL_FILE is set).
// Turbopack bundles nodemailer into a server chunk instead of loading it from node_modules, so no module hook
// reaches it. The runtime loads every chunk with `require`, so the guard rewrites the source of a chunk right
// before Node compiles it: the head of nodemailer's `Mailer#sendMail(data, callback = null)` becomes a call to
// `globalThis.__e2eRecordMail`. Nothing else in the bundle changes: `lib/email.server.ts` still creates its
// transport and `sendSuccessEmail` still runs.
const fs = require("node:fs");

// `sendMail(a,b=null){` in a minified build, `sendMail(data, callback = null) {` unminified. The default value
// `= null` and the opening brace identify the method definition; calls such as `.sendMail(a,b)` do not match.
const SEND_MAIL_HEAD = /\bsendMail\(\s*([\w$]+)\s*,\s*([\w$]+)\s*=\s*null\s*\)\s*\{/g;

// Returns the patched source, the same string when the chunk holds no Mailer, and throws when it holds several
// (a second match means the pattern no longer identifies nodemailer alone).
function patchMailerSource(source) {
  const matches = [...source.matchAll(SEND_MAIL_HEAD)];
  if (matches.length === 0) return source;
  if (matches.length > 1) {
    throw new Error(`e2e mail record: ${matches.length} sendMail definitions in one chunk, expected one`);
  }
  return source.replace(SEND_MAIL_HEAD, (head, data, callback) => `${head}return globalThis.__e2eRecordMail(${data},${callback});`);
}

function addresses(value) {
  return []
    .concat(value ?? [])
    .map((entry) => (typeof entry === "string" ? entry : (entry && entry.address) || ""))
    .filter(Boolean);
}

function installMailRecord(mailFile) {
  globalThis.__e2eRecordMail = function recordMail(data, callback) {
    const to = addresses(data && data.to);
    fs.appendFileSync(
      mailFile,
      `${JSON.stringify({ to: to.join(", "), subject: String(data && data.subject), time: Date.now() })}\n`,
    );
    const info = { messageId: "<e2e-recorded@devspace.test>", accepted: to, rejected: [], response: "e2e mail record" };
    if (typeof callback === "function") {
      process.nextTick(callback, null, info);
      return undefined;
    }
    return Promise.resolve(info);
  };

  const Module = require("node:module");
  const realCompile = Module.prototype._compile;
  Module.prototype._compile = function compile(content, filename) {
    const inChunk = /[\\/]\.next[\\/]server[\\/]chunks[\\/]/.test(filename);
    return realCompile.call(this, inChunk ? patchMailerSource(content) : content, filename);
  };
}

module.exports = { patchMailerSource, installMailRecord };
