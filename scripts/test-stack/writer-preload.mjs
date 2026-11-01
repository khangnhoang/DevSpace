// Loaded into every Node process of a test run through NODE_OPTIONS, before application code. The process records
// itself as a writer and checks that its run still holds the stack lock; if it cannot, it exits without writing or
// spawning anything (AC4). Worker threads share their process's record.
import { basename } from "node:path";
import { isMainThread } from "node:worker_threads";
import { registerWriter, runContext } from "./lock.mjs";

if (isMainThread && process.env.DEVSPACE_TEST_RUN) {
  try {
    registerWriter({ ...runContext(), role: `node ${basename(process.argv[1] ?? "")}`.trim() });
  } catch (error) {
    console.error(`test writer: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
