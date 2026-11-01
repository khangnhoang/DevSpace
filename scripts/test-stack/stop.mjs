// Entry point of `npm run test:stack:stop`: stops the test project only, never the dev stack or another project.
import { stopTestStack } from "./ensure.mjs";

try {
  await stopTestStack();
} catch (error) {
  console.error(`test:stack:stop: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
