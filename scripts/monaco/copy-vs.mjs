#!/usr/bin/env node
// Copies the Monaco editor files of the installed npm package to `public/monaco/vs`, so `/try_it` loads the
// version `package-lock.json` holds from the app's own origin (dependency-maintenance DM-U4). Run by `postinstall`
// (every `npm ci` and argument-free `npm install`, locally, in CI and on Vercel) and by `npm run monaco:copy`.
//
// The old copy is removed first, so a stale or partial tree can never serve a different Monaco than the lockfile.
// The source is read by path: `require.resolve("monaco-editor/package.json")` fails because of the package's
// `exports`.
//
// Usage: node scripts/monaco/copy-vs.mjs
// Exit: 0 copied | 1 source missing or the copy failed (message on stderr).

import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @param {string} source folder to copy
 * @param {string} destination replaced by an exact copy of `source`
 */
export function copyMonaco(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Monaco source folder not found: ${source}. Run npm install first.`);
  }
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(fileURLToPath(import.meta.url), "..", "..", "..");
  try {
    copyMonaco(join(root, "node_modules", "monaco-editor", "min", "vs"), join(root, "public", "monaco", "vs"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
