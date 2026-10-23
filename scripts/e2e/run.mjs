// Entry point of `npm run test:e2e`. It checks the local Supabase stack first, so a stopped stack or a
// non-local API host fails here with a clear message, before the build that playwright.config.ts starts.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readLocalStack } from "../../__tests__/helpers/local-stack.ts";

try {
  readLocalStack(process.cwd());
} catch (error) {
  console.error(`e2e: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const playwrightCli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const result = spawnSync(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
