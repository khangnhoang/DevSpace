#!/usr/bin/env node
// Decides whether a pull request changes documentation only, so CI can skip the `db` and `e2e` jobs
// (infrastructure FEAT-017). Reads the changed paths from stdin, NUL-separated as `git diff --name-only -z
// --no-renames` prints them, and prints `true` or `false`.
//
// The list is an allowlist: a path ends in `.md`, or is exactly one of DOCS_ONLY_FILES. Any other path, also a
// script or an image under `docs/` or `.claude/skills/`, means "run everything", and so does an empty list.
// The workflow relies on this: a wrong `true` skips the database and e2e tests while the PR still shows green.
//
// Usage: git diff --name-only -z --no-renames <base>...<head> | node scripts/ci/docs-only.mjs
// Exit: 0 printed true or false | 2 malformed input (nothing printed, so the caller cannot read a `true`).

import { pathToFileURL } from "node:url";

// The one vendored non-Markdown file under `.claude/skills/` (infrastructure FEAT-017 D7).
export const DOCS_ONLY_FILES = [".claude/skills/playwright-cli/LICENSE"];

/** @param {unknown} path */
function isDocsPath(path) {
  if (typeof path !== "string") return false;
  return path.endsWith(".md") || DOCS_ONLY_FILES.includes(path);
}

/** @param {unknown} paths */
export function isDocsOnly(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return false;
  return paths.every(isDocsPath);
}

// `git diff -z` ends every path with NUL, so input that does not end with one was cut off, and an empty
// segment is not a path. Both throw instead of guessing.
/** @param {Buffer} input */
export function parsePaths(input) {
  if (input.length === 0) return [];
  if (input[input.length - 1] !== 0) throw new Error("input is not NUL-terminated");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  const paths = text.slice(0, -1).split("\0");
  if (paths.some((path) => path === "")) throw new Error("input holds an empty path");
  return paths;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function main() {
  try {
    const paths = parsePaths(await readStdin());
    process.stdout.write(`${isDocsOnly(paths)}\n`);
  } catch (error) {
    process.stderr.write(`docs-only: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
