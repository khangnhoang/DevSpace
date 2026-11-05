// The lifecycle of one test command on the test stack (G5): take the lock before anything else, stop the writers
// an earlier run left behind, mark the run dirty before any work, bring the stack up, run the suite, then wait for
// every writer of the run to exit, audit the database and only then publish `clean`. The lock is released last.
// A command killed anywhere in between leaves `dirty` and a stale lock; the next command takes it over, stops the
// recorded writers and resets.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareSnapshots, takeSnapshot } from "./audit.mjs";
import { ensureTestStack, stopTestStack } from "./ensure.mjs";
import {
  LockError,
  acquireLock,
  awaitRunWriters,
  clearOldRunMarks,
  clearRunWriters,
  closeAdmission,
  reapOrphans,
  registerWriter,
  releaseLock,
  uncleanCause,
} from "./lock.mjs";
import { clearState, readState, stateDir, writeState } from "./state.mjs";
import { assertTestMailboxEmpty } from "./mail.mjs";

const preload = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "writer-preload.mjs"),
).href;

// Every Node process below the child registers as a writer before application code runs (writer-preload.mjs).
// The state directory travels with the run id, so the children use the launcher's directory and nothing else.
/** @param {Record<string, string | undefined>} [inherited] */
export function childEnvironment(runId, dir, inherited = process.env) {
  return {
    ...inherited,
    DEVSPACE_TEST_RUN: runId,
    DEVSPACE_TEST_RUN_DIR: dir,
    NODE_OPTIONS: `${inherited.NODE_OPTIONS ?? ""} --import=${preload}`.trim(),
  };
}

export function spawnNode(args, env) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit" });
  const signals = ["SIGINT", "SIGTERM"];
  const handlers = signals.map((signal) => {
    const handler = () => child.kill(signal);
    process.on(signal, handler);
    return handler;
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      signals.forEach((signal, index) => process.off(signal, handlers[index]));
      resolve(code ?? 1);
    });
  });
}

function markDirty(dir, cause) {
  writeState({ ...(readState(dir) ?? {}), status: "dirty", cause }, dir);
}

// Takes the lock and stops earlier writers; a writer that cannot be stopped leaves the run unclean.
async function enter({ command, root, dir }) {
  const lock = acquireLock({ command, dir, checkout: root });
  try {
    // The holder may have died between publishing its lock and marking the state dirty, so a state that still reads
    // clean cannot be trusted after a takeover.
    if (lock.tookOver && readState(dir)?.status !== "dirty") {
      const { holder } = lock.tookOver;
      markDirty(
        dir,
        `took over the lock of PID ${holder.pid} ("${holder.command}"), which did not finish`,
      );
    }
    clearOldRunMarks({ dir, keep: lock.runId });
    await reapOrphans({ dir });
  } catch (error) {
    if (error instanceof LockError && error.code === "writer-alive")
      markDirty(dir, error.message);
    releaseLock(lock);
    throw error;
  }
  return lock;
}

export async function runOnTestStack({
  command,
  root = process.cwd(),
  dir = stateDir(),
  reset = false,
  waitMs = 30_000,
  ensure = ensureTestStack,
  audit = { takeSnapshot, compareSnapshots },
  beforeChild,
  runChild,
}) {
  const lock = await enter({ command, root, dir });
  const { runId } = lock;
  try {
    registerWriter({ dir, runId, role: "launcher", start: lock.start });
    const prior = readState(dir);
    const inProgress = `run ${runId} (${command}) did not finish`;
    writeState(
      { ...(prior ?? {}), status: "dirty", cause: inProgress, runId },
      dir,
    );

    let mutated = false;
    let ensured;
    try {
      ensured = await ensure({
        root,
        reset,
        state: prior,
        onMutate: () => {
          mutated = true;
        },
      });
      await beforeChild?.(ensured.stack);
    } catch (error) {
      // Nothing was changed yet: the state the last run left is still true.
      if (!mutated) {
        if (prior) writeState(prior, dir);
        else clearState(dir);
      }
      throw error;
    }

    const base = ensured.snapshot
      ? {
          resetHash: ensured.hash,
          snapshot: ensured.snapshot,
          resetAt: new Date().toISOString(),
        }
      : {
          resetHash: prior?.resetHash,
          snapshot: prior?.snapshot,
          resetAt: prior?.resetAt,
        };
    writeState({ ...base, status: "dirty", cause: inProgress, runId }, dir);

    const exitCode = await runChild({
      stack: ensured.stack,
      env: childEnvironment(runId, dir),
    });

    // No process joins the run from here on, so a child that outlived its parent cannot register after the wait
    // below has judged the run and write after the audit. The lock stays held through the audit and the state write.
    closeAdmission({ dir, runId });
    const causes = [];
    const survivors = await awaitRunWriters({ dir, runId, timeoutMs: waitMs });
    if (survivors.length) {
      causes.push(
        `writer process(es) still alive after the run: ${survivors.map((record) => `${record.pid} (${record.role ?? "writer"})`).join(", ")}; the next command stops them`,
      );
    } else {
      clearRunWriters({ dir, runId });
      try {
        // Mail can arrive after a browser failed; it must not be hidden by the database-only snapshot.
        if (ensure === ensureTestStack) await assertTestMailboxEmpty();
        const differences = audit.compareSnapshots(
          base.snapshot,
          await audit.takeSnapshot(ensured.stack.dbUrl),
        );
        if (differences.length)
          causes.push(
            `the end-of-run audit found residue: ${differences.join("; ")}`,
          );
      } catch (error) {
        causes.push(
          `the end-of-run audit could not run: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const marked = uncleanCause({ dir, runId });
    if (marked) causes.push(marked);

    if (causes.length) {
      writeState(
        { ...base, status: "dirty", cause: causes.join(" | "), runId },
        dir,
      );
      console.error(
        `test stack: the run is marked unclean and the next command resets the test database: ${causes.join(" | ")}`,
      );
      return exitCode === 0 ? 1 : exitCode;
    }
    writeState({ ...base, status: "clean", runId }, dir);
    return exitCode;
  } finally {
    releaseLock(lock);
  }
}

// `test:stack:stop` takes the same lock, so it can neither race a start or reset nor stop a stack a live run uses.
export async function stopOnTestStack({
  root = process.cwd(),
  dir = stateDir(),
  stop = stopTestStack,
} = {}) {
  const lock = await enter({ command: "npm run test:stack:stop", root, dir });
  try {
    await stop({ root });
  } finally {
    releaseLock(lock);
  }
}
