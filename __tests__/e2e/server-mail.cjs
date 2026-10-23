"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- a `node --require` preload is CommonJS */
// The mail record of the e2e server (loaded by server-guard.cjs when E2E_MAIL_FILE is set).
// Turbopack bundles nodemailer into a server chunk instead of loading it from node_modules, so no module hook
// reaches it. The runtime loads every chunk with `require`, so the guard rewrites the source of a chunk right
// before Node compiles it: the head of nodemailer's `Mailer#sendMail(data, callback = null)` becomes a call to
// `globalThis.__e2eRecordMail`. Nothing else in the bundle changes: `lib/email.server.ts` still creates its
// transport and `sendSuccessEmail` still runs.
const fs = require("node:fs");

// Nodemailer's `Mailer#sendMail` is the only method that logs the string below and, right before it, reads
// `this.transporter.getSocket`. Both survive minification (the first is a string literal, the second a property
// chain), and both sit in the first lines of the method: in the built chunk they follow the head by about 330
// characters. A chunk without the marker is not touched, whatever else it defines.
const NODEMAILER_MARKER = "Sending mail using %s/%s";
const MAILER_BODY_MARKER = "this.transporter.getSocket";
const BODY_WINDOW = 1500;

// `sendMail(a,b=null){` in a minified build, `sendMail(data, callback = null) {` unminified, as a class member
// (after `{` or `}`). The default value `= null` and the opening brace identify the definition; calls such as
// `.sendMail(a,b)` do not match.
const SEND_MAIL_HEAD = /(?<=[{}]\s*)\bsendMail\(\s*([\w$]+)\s*,\s*([\w$]+)\s*=\s*null\s*\)\s*\{/g;

// Returns the patched source. A source without the nodemailer marker is returned as it is. A source with the
// marker must hold exactly one definition whose body carries both markers, or this throws: nodemailer is there
// and the rewrite cannot be trusted.
function patchMailerSource(source) {
  if (!source.includes(NODEMAILER_MARKER)) return source;
  const all = [...source.matchAll(SEND_MAIL_HEAD)];
  const heads = all.filter((match, index) => {
    const start = match.index + match[0].length;
    // The body ends at the next definition, so a definition in front of nodemailer's cannot borrow its markers.
    const limit = index + 1 < all.length ? all[index + 1].index : source.length;
    const body = source.slice(start, Math.min(start + BODY_WINDOW, limit));
    return body.includes(NODEMAILER_MARKER) && body.includes(MAILER_BODY_MARKER);
  });
  if (heads.length !== 1) {
    throw new Error(
      `e2e mail record: ${heads.length} nodemailer sendMail definitions in a chunk that bundles nodemailer, expected one`,
    );
  }
  const [head, data, callback] = heads[0];
  const end = heads[0].index + head.length;
  return `${source.slice(0, end)}return globalThis.__e2eRecordMail(${data},${callback});${source.slice(end)}`;
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
