// The test stack's identity and its generated Supabase workdir. `npm test` and `npm run test:e2e` run on a
// stack of their own (project `devspace-test`, ports 55320-55329) so they never read, reset or stop the dev
// stack that holds the data for manual QA. The workdir is generated from `supabase/` on every command, so the
// test config cannot drift from the real migrations and seed, and nothing in it is committed.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const TEST_PROJECT_ID = "devspace-test";
export const TEST_WORKDIR_NAME = ".supabase-test";
export const TEST_NETWORK = `supabase_network_${TEST_PROJECT_ID}`;
// Matches CLI 2.121.0's resolved Mailpit image; the runner owns only its explicit loopback publication.
export const TEST_MAILPIT_IMAGE = "public.ecr.aws/supabase/mailpit:v1.31.3";
export const MAILBOX_OWNER = "devspace.test.mailbox";

// None of these overlaps the dev range (54320-54329) or the ports VocaSpace publishes (45321-45324).
export const TEST_PORTS = {
  api: 55321,
  db: 55322,
  shadow: 55320,
  studio: 55323,
  smtp: 55324,
  analytics: 55327,
  inspector: 55328,
  pooler: 55329,
};

// Mailpit is required by recovery tests. Realtime stays excluded because no suite needs it
// (PR 49 run 41311090918 passed without it).
export const EXCLUDED_SERVICES = [
  "mailpit", // Created by the locked runner; CLI publication omits the required host address.
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "imgproxy",
  "supavisor",
  "realtime",
  "postgres-meta",
];

// Services required before any suite or recovery mailbox request can run.
export const REQUIRED_SERVICES = [
  "db",
  "kong",
  "auth",
  "rest",
  "storage",
  "inbucket",
];
export const requiredContainerNames = (project = TEST_PROJECT_ID) =>
  REQUIRED_SERVICES.map((service) => `supabase_${service}_${project}`);

export const testWorkdir = (root) => join(root, TEST_WORKDIR_NAME);

// [section, key, replacement TOML value]. A rule that matches nothing throws, so a renamed key in the dev
// config cannot silently leave a dev value (and a dev port) in the test config.
const RULES = [
  ["", "project_id", JSON.stringify(TEST_PROJECT_ID)],
  ["api", "port", TEST_PORTS.api],
  ["db", "port", TEST_PORTS.db],
  ["db", "shadow_port", TEST_PORTS.shadow],
  ["db.pooler", "port", TEST_PORTS.pooler],
  ["studio", "enabled", "false"],
  ["studio", "port", TEST_PORTS.studio],
  ["local_smtp", "enabled", "true"],
  ["local_smtp", "port", TEST_PORTS.smtp],
  ["analytics", "port", TEST_PORTS.analytics],
  ["edge_runtime", "inspector_port", TEST_PORTS.inspector],
  // The e2e server listens on 3100, and Auth redirects must name it.
  ["auth", "site_url", JSON.stringify("http://127.0.0.1:3100")],
  [
    "auth",
    "additional_redirect_urls",
    JSON.stringify(["https://127.0.0.1:3100"]),
  ],
];

export function generateTestConfig(source) {
  // Never inherit a real SMTP provider or expose SMTP/POP3 when mail capture is enabled.
  if (
    /^\s*\[\s*auth\.email\.smtp\s*\]/m.test(source) ||
    /^\s*(?:smtp_port|pop3_port)\s*=/m.test(source)
  ) {
    throw new Error(
      "Test mail must use only the CLI Mailpit sink, with no published SMTP/POP3 or external SMTP config.",
    );
  }
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
        `supabase/config.toml has no "${key}" under [${ruleSection || "top level"}], so the test config cannot be generated. Update scripts/test-stack/config.mjs RULES.`,
      );
    }
  }
  return out.join("\n");
}

// Writes `<root>/.supabase-test/supabase/` and returns the workdir plus the hash of everything a reset applies.
export function prepareTestWorkdir(root) {
  const source = join(root, "supabase");
  const workdir = testWorkdir(root);
  const target = join(workdir, "supabase");
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, "config.toml"),
    generateTestConfig(readFileSync(join(source, "config.toml"), "utf8")),
  );
  // The copy is replaced as a whole so a migration removed from `supabase/` disappears from the test stack too.
  rmSync(join(target, "migrations"), { recursive: true, force: true });
  cpSync(join(source, "migrations"), join(target, "migrations"), {
    recursive: true,
  });
  cpSync(join(source, "seed.sql"), join(target, "seed.sql"));
  // The workdir never carries a project link: a link would let a CLI command reach the hosted project (G2).
  rmSync(join(target, ".temp"), { recursive: true, force: true });
  return { workdir, hash: hashTestWorkdir(workdir) };
}

function listFiles(dir, base = "") {
  return readdirSync(join(dir, base), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = base ? `${base}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(dir, path) : [path];
    },
  );
}

export function hashTestWorkdir(workdir) {
  const target = join(workdir, "supabase");
  const hash = createHash("sha256");
  for (const file of [
    "config.toml",
    "seed.sql",
    ...listFiles(target, "migrations").sort(),
  ]) {
    if (!existsSync(join(target, file))) continue;
    hash
      .update(`${file}\0`)
      .update(readFileSync(join(target, file)))
      .update("\0");
  }
  return hash.digest("hex");
}
