// Picks the files the docs scanners look at: git-tracked files plus untracked files that are not ignored,
// so a local run and a clean checkout see the same set. When the root is not the top of a git work tree
// (a test fixture, a downloaded folder) it returns null and the caller walks the filesystem instead.

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

function samePath(a, b) {
  const normalize = (value) => {
    let real = value;
    try {
      real = realpathSync(value);
    } catch {
      // a path that does not exist is compared as written
    }
    const full = resolve(real);
    return process.platform === "win32" ? full.toLowerCase() : full;
  };
  return normalize(a) === normalize(b);
}

export function repoFileIndex(root) {
  const top = spawnSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (top.status !== 0 || !samePath(top.stdout.trim(), root)) return null;
  const listed = spawnSync(
    "git",
    ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (listed.status !== 0) return null;

  const files = new Set(
    listed.stdout
      .split("\0")
      .filter(Boolean)
      // `--cached` still lists files deleted from the working tree whose deletion is not staged
      .filter((rel) => existsSync(join(root, rel))),
  );
  const dirs = new Set([""]);
  for (const rel of files) {
    let index = rel.lastIndexOf("/");
    while (index > 0) {
      dirs.add(rel.slice(0, index));
      index = rel.lastIndexOf("/", index - 1);
    }
  }
  return {
    files: [...files],
    has: (rel) => files.has(rel),
    hasDir: (rel) => dirs.has(rel),
  };
}
