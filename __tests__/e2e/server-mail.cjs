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
// `this.transporter.getSocket`. Both survive minification (a string literal and a property chain) and both sit in
// the method's own body. A chunk without the marker is not parsed or touched, whatever else it defines.
const NODEMAILER_MARKER = "Sending mail using %s/%s";
const MAILER_BODY_MARKER = "this.transporter.getSocket";

function contains(ts, node, predicate) {
  return predicate(node) || ts.forEachChild(node, (child) => contains(ts, child, predicate)) === true;
}

// A real parse, not a pattern: a regex or a brace count cannot tell code from text in JavaScript (a `/` after
// `if (...)` starts a regex, a `}` can sit in a string, a template or a comment), and a wrong guess patches the
// wrong method. The definition is a method `sendMail(<identifier>, <identifier> = null)` whose own body holds the
// marker as a string literal and the body marker as a property access. Markers in a comment are not nodes, so
// they never count. TypeScript is a devDependency and loads only when a chunk bundles nodemailer.
function patchMailerSource(source) {
  if (!source.includes(NODEMAILER_MARKER)) return source;

  const ts = require("typescript");
  const sourceFile = ts.createSourceFile("chunk.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // `parseDiagnostics` is not in the public typings; the syntax errors of the parse are only there.
  const [problem] = sourceFile.parseDiagnostics;
  if (problem) {
    throw new Error(
      `e2e mail record: cannot parse the chunk that bundles nodemailer: ${ts.flattenDiagnosticMessageText(problem.messageText, " ")} (offset ${problem.start})`,
    );
  }

  const definitions = [];
  const visit = (node) => {
    if (isMailerSendMail(ts, sourceFile, node)) definitions.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (definitions.length !== 1) {
    throw new Error(
      `e2e mail record: ${definitions.length} nodemailer sendMail definitions in a chunk that bundles nodemailer, expected one`,
    );
  }
  const [method] = definitions;
  const [data, callback] = method.parameters.map((parameter) => parameter.name.text);
  const insertAt = method.body.getStart(sourceFile) + 1; // right after the body's `{`
  return `${source.slice(0, insertAt)}return globalThis.__e2eRecordMail(${data},${callback});${source.slice(insertAt)}`;
}

function isMailerSendMail(ts, sourceFile, node) {
  if (!ts.isMethodDeclaration(node) || !node.body || !ts.isIdentifier(node.name) || node.name.text !== "sendMail") return false;
  if (node.parameters.length !== 2) return false;
  const [data, callback] = node.parameters;
  if (!ts.isIdentifier(data.name) || !ts.isIdentifier(callback.name)) return false;
  if (!callback.initializer || callback.initializer.kind !== ts.SyntaxKind.NullKeyword) return false;
  return (
    contains(ts, node.body, (child) => ts.isStringLiteral(child) && child.text === NODEMAILER_MARKER) &&
    contains(ts, node.body, (child) => ts.isPropertyAccessExpression(child) && child.getText(sourceFile) === MAILER_BODY_MARKER)
  );
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
