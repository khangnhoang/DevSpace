// Entry point of `npm run test:stack:stop`: stops the test project only, never the dev stack or another project.
// It takes the same lock as the test commands, so it refuses while one is running.
import { stopOnTestStack } from "./run.mjs";

try {
  await stopOnTestStack();
} catch (error) {
  console.error(`test:stack:stop: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
