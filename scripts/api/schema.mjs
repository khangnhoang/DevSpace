// Generates backend/src/db/schema.ts and relations.ts from a local database with `drizzle-kit pull` (ADR 0008 D9).
//   node scripts/api/schema.mjs            pull from the dev stack and write the two files
//   node scripts/api/schema.mjs --check    pull from the test stack and fail when the committed files differ (CI, `db` job)
// Only loopback hosts are accepted (plan G7). The baseline SQL and meta/ that pull also writes are removed with the
// scratch folder and never applied. The check takes the test stack lock like `npm test` (it starts the stack when
// it is down), and only reads the database.
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLocalUrl,
  readLocalStack,
} from "../../__tests__/helpers/local-stack.ts";
import { readTestStack } from "../test-stack/read.mjs";
import { runOnTestStack, spawnNode } from "../test-stack/run.mjs";
import { repairGenerated } from "./repair-generated.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(root, "backend", "src", "db");
const FILES = ["schema.ts", "relations.ts"];

function pull(dbUrl) {
  assertLocalUrl("The database URL for drizzle-kit pull", dbUrl, [
    "postgresql:",
    "postgres:",
  ]);
  const out = mkdtempSync(join(tmpdir(), "devspace-drizzle-"));
  // The package exports no path to its bin file and npm hoists the workspace dependency to the root.
  const bin = join(root, "node_modules", "drizzle-kit", "bin.cjs");
  // The URL travels only in the child's environment, never in an argument or a log line.
  const result = spawnSync(
    process.execPath,
    [bin, "pull", "--config", join(root, "backend", "drizzle.config.ts")],
    {
      cwd: join(root, "backend"),
      env: { ...process.env, DRIZZLE_DATABASE_URL: dbUrl, DRIZZLE_OUT: out },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  if (result.status !== 0) {
    rmSync(out, { recursive: true, force: true });
    throw new Error("drizzle-kit pull failed.");
  }
  for (const file of FILES)
    writeFileSync(
      join(out, file),
      repairGenerated(file, readFileSync(join(out, file), "utf8")),
    );
  return out;
}

function pullDev() {
  const out = pull(readLocalStack(root).dbUrl);
  try {
    for (const file of FILES) copyFileSync(join(out, file), join(target, file));
    console.log(
      `schema: wrote ${FILES.join(" and ")} to backend/src/db from the dev stack.`,
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

function compareTest() {
  const out = pull(readTestStack(root).dbUrl);
  try {
    const normalize = (path) =>
      readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    const different = FILES.filter(
      (file) =>
        !existsSync(join(target, file)) ||
        normalize(join(target, file)) !== normalize(join(out, file)),
    );
    if (different.length > 0) {
      console.error(
        `schema: ${different.join(" and ")} differ from the test stack's schema. Run npm run api:schema:pull on the dev stack and commit the result.`,
      );
      return 1;
    }
    console.log("schema: backend/src/db matches the test stack.");
    return 0;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

try {
  const args = process.argv.slice(2);
  if (args.includes("--compare")) {
    process.exitCode = compareTest();
  } else if (args.includes("--check")) {
    process.exitCode = await runOnTestStack({
      command: "npm run api:schema:check",
      runChild: ({ env }) =>
        spawnNode([fileURLToPath(import.meta.url), "--compare"], env),
    });
  } else {
    pullDev();
  }
} catch (error) {
  console.error(
    `schema: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
