import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

function sourceFiles(path: string): string[] {
  const full = join(root, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(path, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(full, entry.name)] : [],
  );
}

// Every name the app code reads, plus the places that read the object without a name (destructuring or bracket
// access), which this scan cannot attribute to a variable.
export function envReads() {
  const names = new Set<string>();
  const unnamed: string[] = [];
  for (const file of ["app", "lib", "proxy.ts"].flatMap(sourceFiles)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(match[1]);
    if (/process\.env(?!\.[A-Za-z_])/.test(text)) unnamed.push(file);
  }
  return { names, unnamed };
}
