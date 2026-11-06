// A child process for the lock and lifecycle rows of __tests__/unit/test-stack-lock.test.ts. Each mode is one
// role in a scenario; it prints one JSON line per event on stdout. The test owns the state directory
// (STACK_PROBE_DIR, passed to every call as `dir`; the production directory ignores the environment) and runs this
// from the repository root. No Docker and no database are involved.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const url = (path) => pathToFileURL(join(process.cwd(), path)).href;
const lock = await import(url("scripts/test-stack/lock.mjs"));
const dir = process.env.STACK_PROBE_DIR;
const say = (event) => console.log(JSON.stringify(event));
const forever = () => new Promise(() => setInterval(() => {}, 1000));
const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const [mode, ...args] = process.argv.slice(2);

if (mode === "hold") {
  const held = lock.acquireLock({
    command: args[0] ?? "probe hold",
    checkout: args[1] ?? process.cwd(),
    dir,
  });
  say({ event: "held", pid: process.pid, generation: held.generation });
  await forever();
} else if (mode === "acquire-release") {
  const held = lock.acquireLock({ command: "probe acquire-release", dir });
  lock.releaseLock(held);
  say({ event: "released", generation: held.generation });
} else if (mode === "contend") {
  const [barrier, checkout] = args;
  while (!existsSync(barrier)) sleep(5);
  try {
    const held = lock.acquireLock({ command: "probe contend", checkout, dir });
    say({
      event: "won",
      generation: held.generation,
      tookOver: Boolean(held.tookOver),
    });
    await forever();
  } catch (error) {
    say({ event: "refused", code: error.code, message: error.message });
  }
} else if (mode === "pause-contend") {
  // Reads the lock, then waits for the go file before it claims.
  const [goFile] = args;
  try {
    const held = lock.acquireLock({
      command: "probe pause-contend",
      dir,
      afterRead: () => {
        say({ event: "read" });
        while (!existsSync(goFile)) sleep(5);
      },
    });
    say({ event: "won", generation: held.generation });
  } catch (error) {
    say({ event: "refused", code: error.code, message: error.message });
  }
} else if (mode === "idle") {
  say({ event: "idle", pid: process.pid });
  await forever();
} else if (mode === "writer") {
  // The writer preload has already registered this process and checked its run's lock.
  say({ event: "passed", pid: process.pid });
  if (args[0] === "spawn-unrecorded") {
    const env = { ...process.env };
    delete env.DEVSPACE_TEST_RUN;
    delete env.DEVSPACE_TEST_RUN_DIR;
    delete env.NODE_OPTIONS;
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "idle"],
      { env, stdio: ["ignore", "pipe", "inherit"], detached: true },
    );
    child.stdout.once("data", () => say({ event: "child", pid: child.pid }));
  }
  await forever();
} else if (mode === "late-write") {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(args[0], "written");
  say({ event: "wrote" });
} else if (mode === "delayed-register") {
  // A child that outlived its parent and joins the run only when told to, after the launcher has stopped admitting.
  const [goFile, resultFile] = args;
  while (!existsSync(goFile)) sleep(5);
  const { writeFileSync } = await import("node:fs");
  try {
    lock.registerWriter({ dir, role: "late" });
    writeFileSync(resultFile, "passed");
    await forever();
  } catch (error) {
    writeFileSync(resultFile, `lost: ${error.message}`);
  }
} else if (mode === "register") {
  const [barrier] = args;
  while (!existsSync(barrier)) sleep(2);
  try {
    lock.registerWriter({ dir, role: "probe" });
    say({ event: "passed", pid: process.pid });
    await forever();
  } catch (error) {
    say({ event: "lost", message: error.message });
  }
} else if (mode === "fixture-fail" || mode === "fixture-open") {
  const { FixtureScope } = await import(
    url("__tests__/helpers/fixture-ownership.ts")
  );
  let reading = false;
  const db = {
    from: () => ({
      select: () => ({
        match: async () => ({ data: reading ? [{ id: 1 }] : [], error: null }),
      }),
      delete: () => ({
        in: async () => ({ data: [], error: { message: "delete refused" } }),
      }),
    }),
  };
  if (mode === "fixture-fail") {
    const scope = new FixtureScope(db, "unused");
    await scope.reserve("notifications", { title: "probe" });
    reading = true;
    await scope.cleanup().then(
      () => say({ event: "cleaned" }),
      () => say({ event: "cleanup-failed" }),
    );
  } else {
    try {
      new FixtureScope(db, "unused");
      say({ event: "opened" });
    } catch (error) {
      say({ event: "refused", message: error.message });
    }
  }
} else if (mode === "run") {
  const [scenario, root] = args;
  const run = await import(url("scripts/test-stack/run.mjs"));
  const { decideReset } = await import(url("scripts/test-stack/ensure.mjs"));
  const probe = join(process.cwd(), "__tests__/helpers/stack-probe.mjs");
  const code = await run.runOnTestStack({
    command: `probe run ${scenario}`,
    root: root ?? process.cwd(),
    dir,
    waitMs: 800,
    ensure: async ({ state, onMutate }) => {
      const decision = decideReset({
        state,
        hash: "h",
        fresh: false,
        force: false,
      });
      say({
        event: "ensure",
        status: state?.status ?? null,
        cause: state?.cause ?? null,
        kind: decision.kind,
      });
      if (scenario === "hang-mutate") {
        onMutate();
        say({ event: "mutating" });
        await forever();
      }
      return {
        stack: { dbUrl: "unused" },
        decision,
        hash: "h",
        snapshot: { tables: {} },
      };
    },
    audit: {
      takeSnapshot: async () => {
        if (scenario === "hang-audit") {
          say({ event: "auditing" });
          await forever();
        }
        if (scenario === "late-register") {
          // The audit interval: the child registers now.
          const { writeFileSync, readFileSync } = await import("node:fs");
          writeFileSync(join(dir, "late-go"), "");
          const deadline = Date.now() + 20_000;
          while (!existsSync(join(dir, "late-result")) && Date.now() < deadline)
            await new Promise((resolve) => setTimeout(resolve, 20));
          say({
            event: "late-result",
            result: existsSync(join(dir, "late-result"))
              ? readFileSync(join(dir, "late-result"), "utf8")
              : null,
          });
        }
        return { tables: {} };
      },
      compareSnapshots: () =>
        scenario === "residue"
          ? ["public.notes: 1 rows at the last reset, 2 now"]
          : [],
    },
    runChild: async ({ env }) => {
      if (scenario === "hang-compat-intent") {
        const { writeFileSync } = await import("node:fs");
        const { graphqlCompatJournal } = await import(
          url("scripts/test-stack/graphql-compat.mjs")
        );
        writeFileSync(
          graphqlCompatJournal(dir),
          JSON.stringify({ owner: "unresolved-intent" }),
        );
        say({ event: "compat-intent" });
        await forever();
      }
      if (scenario === "fail-tests") return 1;
      if (scenario === "fixture-failure") {
        await run.spawnNode([probe, "fixture-fail"], env);
        await run.spawnNode([probe, "fixture-open"], env);
        return 0;
      }
      if (scenario === "late-register") {
        // Detached, and without the preload, so it does not register at startup: it registers late, on cue.
        const childEnv = { ...env };
        delete childEnv.NODE_OPTIONS;
        const late = spawn(
          process.execPath,
          [
            probe,
            "delayed-register",
            join(dir, "late-go"),
            join(dir, "late-result"),
          ],
          { env: childEnv, stdio: "ignore", detached: true },
        );
        late.unref();
        say({ event: "late-child", pid: late.pid });
        return 0;
      }
      if (scenario === "leak" || scenario === "hang-writer") {
        // libuv ends a non-detached child with its parent on Windows; a detached one is how a writer outlives its run.
        const writer = spawn(process.execPath, [probe, "writer"], {
          env,
          stdio: ["ignore", "pipe", "inherit"],
          detached: true,
        });
        await new Promise((resolve) => writer.stdout.once("data", resolve));
        say({ event: "writer", pid: writer.pid });
        if (scenario === "hang-writer") await forever();
        writer.stdout.destroy();
        writer.unref();
      }
      return 0;
    },
  });
  say({ event: "done", code });
} else if (mode === "stop") {
  const run = await import(url("scripts/test-stack/run.mjs"));
  await run
    .stopOnTestStack({
      root: process.cwd(),
      dir,
      stop: async () => say({ event: "stopped" }),
    })
    .then(
      () => say({ event: "done" }),
      (error) =>
        say({ event: "refused", code: error.code, message: error.message }),
    );
}
