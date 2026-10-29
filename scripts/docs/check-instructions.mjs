#!/usr/bin/env node
// Validates only DevSpace's four-file flat import contract, not general Claude import syntax.
// Exit: 0 valid | 1 contract violation | 2 usage or unexpected read error.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY = "CLAUDE.md";
const REQUIRED = ["AGENTS.md", "docs/agent-loops.md", ".claude/rules.md"];
const FILES = [ENTRY, ...REQUIRED];

// Preserve newlines so diagnostics identify the original instruction line. Examples inside
// fenced or inline code (including multiline spans) cannot become executable import edges.
function withoutCode(text) {
  let fence;
  const unfenced = text.split("\n").map((line) => {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.char}{${fence.length},}[ \\t]*$`).test(line)) fence = undefined;
      return "";
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) {
      fence = { char: open[1][0], length: open[1].length };
      return "";
    }
    return line;
  }).join("\n");
  const runs = [...unfenced.matchAll(/`+/g)];
  const chars = unfenced.split("");
  for (let i = 0; i < runs.length; i += 1) {
    const close = runs.findIndex((run, j) => j > i && run[0].length === runs[i][0].length);
    if (close < 0) continue;
    for (let j = runs[i].index; j < runs[close].index + runs[close][0].length; j += 1) {
      if (chars[j] !== "\n") chars[j] = " ";
    }
    i = close;
  }
  return chars.join("");
}

function imports(text) {
  return withoutCode(text.replace(/\r\n/g, "\n")).split("\n").flatMap((line, i) => {
    const match = line.match(/^ {0,3}@(\S+)[ \t]*$/);
    return match ? [{ target: match[1], line: i + 1 }] : [];
  });
}

export function checkInstructions(root) {
  const violations = [];
  const graph = new Map();
  const report = (file, line, rule, message) => violations.push({ file, line, rule, message });
  for (const file of FILES) {
    const full = resolve(root, file);
    if (!existsSync(full) || !statSync(full).isFile()) {
      report(file, 1, "instruction-file", "required instruction file is missing");
      graph.set(file, []);
      continue;
    }
    const edges = imports(readFileSync(full, "utf8"));
    graph.set(file, edges);
    const seen = new Set();
    for (const { target, line } of edges) {
      const destination = resolve(dirname(full), target);
      if (!existsSync(destination) || !statSync(destination).isFile()) {
        report(file, line, "import-target", `missing import target: ${target}`);
      }
      if (file !== ENTRY) report(file, line, "nested-import", "shared owners and Claude bindings must not import other files");
      else if (!REQUIRED.includes(target)) report(file, line, "unexpected-import", `unexpected import: ${target}`);
      if (seen.has(target)) report(file, line, "repeated-import", `repeated import: ${target}`);
      seen.add(target);
    }
    if (file === ENTRY) {
      for (const target of REQUIRED) {
        if (!seen.has(target)) report(file, 1, "required-import", `missing required import: ${target}`);
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(file) {
    visiting.add(file);
    for (const { target, line } of graph.get(file)) {
      const destination = resolve(root, dirname(file), target);
      const next = FILES.find((candidate) => resolve(root, candidate) === destination);
      if (!next) continue;
      if (visiting.has(next)) report(file, line, "import-cycle", `import cycle reaches ${next}`);
      else if (!visited.has(next)) visit(next);
    }
    visiting.delete(file);
    visited.add(file);
  }
  for (const file of FILES) if (!visited.has(file)) visit(file);
  return violations;
}

function main() {
  const args = process.argv.slice(2);
  let root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--root") {
      console.error("Usage: check-instructions.mjs [--root <dir>]");
      return 2;
    }
    root = resolve(args[1]);
  }
  try {
    if (!statSync(root).isDirectory()) throw new Error(`Root is not a directory: ${root}`);
    const violations = checkInstructions(root);
    for (const { file, line, rule, message } of violations) console.error(`${file}:${line} [${rule}] ${message}`);
    console.log(`Instruction import violations: ${violations.length}.`);
    return violations.length ? 1 : 0;
  } catch (error) {
    console.error(`Cannot check instructions: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
