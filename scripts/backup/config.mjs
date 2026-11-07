// The scratch Supabase stack of `npm run backup:check` (TM-U1): project `devspace-backup-check`, ports
// 56320-56329, a generated workdir under the ignored `/.supabase-backup-check/`. It shares no name, port or
// volume with the dev stack (54320-54329), the test stack (55320-55329) or VocaSpace (45321-45324).
//
// The workdir holds a config and the three service version files, nothing else: no migrations and no seed, so
// the `public` schema is empty before the import, and never `project-ref`, `linked-project.json` or `pooler-url`,
// because a link would point CLI calls in that workdir at the hosted project (G8).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const SCRATCH_PROJECT_ID = "devspace-backup-check";
export const SCRATCH_WORKDIR_NAME = ".supabase-backup-check";
export const SCRATCH_NETWORK = `supabase_network_${SCRATCH_PROJECT_ID}`;

export const SCRATCH_PORTS = {
  shadow: 56320,
  api: 56321,
  db: 56322,
  studio: 56323,
  smtp: 56324,
  analytics: 56327,
  inspector: 56328,
  pooler: 56329,
};

// Auth and Storage start once so their own migrations create the `auth` and `storage` schemas at the pinned
// versions; everything else stays off.
export const EXCLUDED_SERVICES = [
  "mailpit",
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "imgproxy",
  "supavisor",
  "realtime",
  "postgres-meta",
];

// The CLI reads the hosted service versions from `supabase/.temp` and pins its containers to them (CP2 finding).
export const VERSION_FILES = [
  "postgres-version",
  "gotrue-version",
  "storage-version",
];

export const scratchWorkdir = (root) => join(root, SCRATCH_WORKDIR_NAME);
export const runRecordPath = (root) => join(scratchWorkdir(root), "run.json");

// [section, key, replacement TOML value]. A rule that matches nothing throws, so a renamed key in the dev config
// cannot leave a dev value (and a dev port) in the scratch config.
const RULES = [
  ["", "project_id", JSON.stringify(SCRATCH_PROJECT_ID)],
  ["api", "port", SCRATCH_PORTS.api],
  ["db", "port", SCRATCH_PORTS.db],
  ["db", "shadow_port", SCRATCH_PORTS.shadow],
  ["db.pooler", "port", SCRATCH_PORTS.pooler],
  ["studio", "enabled", "false"],
  ["studio", "port", SCRATCH_PORTS.studio],
  ["analytics", "port", SCRATCH_PORTS.analytics],
  ["edge_runtime", "inspector_port", SCRATCH_PORTS.inspector],
];

export function generateScratchConfig(source) {
  const lines = source.split("\n");
  const matched = new Set();
  let section = "";
  const out = lines.map((line) => {
    const header = /^\s*\[([^\]]+)\]\s*(#.*)?\r?$/.exec(line);
    if (header) {
      section = header[1].trim();
      return line;
    }
    for (const [ruleSection, key, value] of RULES) {
      if (ruleSection !== section) continue;
      if (!new RegExp(`^${key}\\s*=`).test(line)) continue;
      matched.add(`${ruleSection}.${key}`);
      return `${key} = ${value}${line.endsWith("\r") ? "\r" : ""}`;
    }
    return line;
  });
  for (const [ruleSection, key] of RULES) {
    if (!matched.has(`${ruleSection}.${key}`)) {
      throw new Error(
        `supabase/config.toml has no "${key}" under [${ruleSection || "top level"}], so the scratch config cannot be generated. Update scripts/backup/config.mjs RULES.`,
      );
    }
  }
  return out.join("\n");
}

// Writes `<root>/.supabase-backup-check/supabase/{config.toml,.temp/<version files>}` and returns the workdir.
// Throws naming the missing file when the checkout lacks a version file (G8).
export function prepareScratchWorkdir(root) {
  const source = join(root, "supabase");
  const workdir = scratchWorkdir(root);
  const target = join(workdir, "supabase");
  // Whole-folder replacement: nothing from an earlier run (a seed, a migration, a link) can survive.
  rmSync(target, { recursive: true, force: true });
  mkdirSync(join(target, ".temp"), { recursive: true });
  writeFileSync(
    join(target, "config.toml"),
    generateScratchConfig(readFileSync(join(source, "config.toml"), "utf8")),
  );
  const versions = {};
  for (const name of VERSION_FILES) {
    const file = join(source, ".temp", name);
    if (!existsSync(file)) {
      throw new Error(
        `supabase/.temp/${name} is missing, so the scratch stack cannot be pinned to the hosted service versions. Nothing was started.`,
      );
    }
    copyFileSync(file, join(target, ".temp", name));
    versions[name] = readFileSync(file, "utf8").trim();
  }
  return { workdir, versions };
}
