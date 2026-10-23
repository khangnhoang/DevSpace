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
// chain) and both sit in the method's own body. A chunk without the marker is not touched, whatever else it defines.
const NODEMAILER_MARKER = "Sending mail using %s/%s";
const MAILER_BODY_MARKER = "this.transporter.getSocket";

// `sendMail(a,b=null){` in a minified build, `sendMail(data, callback = null) {` unminified, as a class member
// (after `{` or `}`). The default value `= null` and the opening brace identify the definition; calls such as
// `.sendMail(a,b)` do not match. The regex cannot tell code from text, so a match counts only when `codeMask`
// says its first and last character are code.
const SEND_MAIL_HEAD = /(?<=[{}]\s*)\bsendMail\(\s*([\w$]+)\s*,\s*([\w$]+)\s*=\s*null\s*\)\s*\{/g;

// A regex literal can follow these words (`return /x/.test(y)`); after any other word `/` divides.
const KEYWORDS_BEFORE_REGEX = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new", "else", "do", "yield", "await"]);

const isSpace = (char) => char === " " || char === "\n" || char === "\r" || char === "\t";
const isWordChar = (char) => /[\w$]/.test(char);

// Why this exists: matching a body by distance or by the next head lets a definition borrow the markers of the
// method after it, and a braces count is wrong while a `}` sits in a string, a template, a comment or a regex
// literal. `codeMask` returns 1 for every character of `source` that is code and 0 for text: string and
// template text, the `${` and `}` that delimit a template expression (its inner code stays code), comments and
// regex literals. It throws when the source ends inside text, so a scan that lost track fails loud.
// Whether `/` starts a regex is the one heuristic: it does when the last code character is an operator or an
// opening bracket, or a keyword such as `return`, and divides after a value.
function codeMask(source) {
  const length = source.length;
  const mask = new Uint8Array(length);
  const expressions = []; // one counter per open `${`: the braces opened inside it
  let last = -1; // index of the last non-space code character

  const fail = (what, at) => {
    throw new Error(`e2e mail record: the chunk ends inside ${what} that starts at offset ${at}`);
  };
  // Scans template text from `from` up to and past the closing backtick or the next `${`.
  const templateText = (from) => {
    for (let j = from; j < length; j++) {
      if (source[j] === "\\") j++;
      else if (source[j] === "`") return j + 1;
      else if (source[j] === "$" && source[j + 1] === "{") {
        expressions.push(0);
        return j + 2;
      }
    }
    return fail("a template literal", from);
  };
  const skipString = (from) => {
    for (let j = from + 1; j < length; j++) {
      if (source[j] === "\\") j++;
      else if (source[j] === source[from]) return j + 1;
      else if (source[j] === "\n") break;
    }
    return fail("a string literal", from);
  };
  // Returns the index after a regex literal that starts at `from`, or -1 when the line ends first (a division).
  const skipRegex = (from) => {
    let inClass = false;
    for (let j = from + 1; j < length && source[j] !== "\n"; j++) {
      if (source[j] === "\\") j++;
      else if (source[j] === "[") inClass = true;
      else if (source[j] === "]") inClass = false;
      else if (source[j] === "/" && !inClass) return j + 1;
    }
    return -1;
  };
  const regexAllowed = () => {
    if (last < 0) return true;
    const char = source[last];
    if (isWordChar(char)) {
      let start = last;
      while (start > 0 && isWordChar(source[start - 1])) start--;
      return KEYWORDS_BEFORE_REGEX.has(source.slice(start, last + 1));
    }
    if ((char === "+" || char === "-") && source[last - 1] === char) return false; // `i++ / 2`
    return !")]}\"'`".includes(char);
  };

  let i = 0;
  while (i < length) {
    const char = source[i];
    if (char === '"' || char === "'") {
      i = skipString(i);
      last = i - 1;
      continue;
    }
    if (char === "`") {
      i = templateText(i + 1);
      last = i - 1;
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      i = end < 0 ? length : end;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) fail("a block comment", i);
      i = end + 2;
      continue;
    }
    if (char === "/" && regexAllowed()) {
      const end = skipRegex(i);
      if (end > 0) {
        i = end;
        last = i - 1;
        continue;
      }
    }
    if (char === "}" && expressions.length && expressions[expressions.length - 1] === 0) {
      expressions.pop();
      i = templateText(i + 1);
      last = i - 1;
      continue;
    }
    if (expressions.length && char === "{") expressions[expressions.length - 1]++;
    if (expressions.length && char === "}") expressions[expressions.length - 1]--;
    mask[i] = 1;
    if (!isSpace(char)) last = i;
    i++;
  }
  if (expressions.length) fail("a template expression", length);
  return mask;
}

// The index of the `}` that closes the `{` at `open`, counting only code braces.
function closingBrace(source, mask, open) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (!mask[i]) continue;
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return i;
  }
  throw new Error(`e2e mail record: the sendMail definition at offset ${open} has no closing brace`);
}

// Returns the patched source. A source without the nodemailer marker is returned as it is. A source with the
// marker must hold exactly one definition, in code, whose own body carries both markers, or this throws: nodemailer
// is there and the rewrite cannot be trusted.
function patchMailerSource(source) {
  if (!source.includes(NODEMAILER_MARKER)) return source;
  const mask = codeMask(source);
  const heads = [...source.matchAll(SEND_MAIL_HEAD)].filter((match) => {
    const end = match.index + match[0].length;
    if (!mask[match.index] || !mask[end - 1]) return false;
    const body = source.slice(end, closingBrace(source, mask, end - 1));
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
