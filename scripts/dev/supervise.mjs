// Runs several processes as one: when any of them exits, the others are stopped and the result is non-zero, so
// `npm run dev` never keeps one server alive after the other died (AC3). A signal stops them all.
// On Windows `child.kill()` ends only the process it started, and `next dev` and the API may have started
// children of their own, so the whole tree is ended with taskkill.
import { spawn, spawnSync } from "node:child_process";

function stopTree(child) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

/**
 * @param {{ name: string, command: string, args: string[], env?: Record<string, string | undefined>, cwd?: string }[]} specs
 * @param {{ log?: (line: string) => void }} [options]
 * @returns {Promise<number>} 0 only when a signal stopped every process; otherwise non-zero
 */
export function superviseAll(
  specs,
  { log = (line) => console.error(line) } = {},
) {
  return new Promise((resolve) => {
    let failure = null;
    let interrupted = false;
    const running = new Set();

    const stopAll = () => {
      for (const child of running) stopTree(child);
    };
    const onSignal = () => {
      interrupted = true;
      stopAll();
    };
    const signals = ["SIGINT", "SIGTERM"];
    for (const signal of signals) process.on(signal, onSignal);

    const ended = (child, spec, message, code) => {
      if (!running.delete(child)) return;
      if (!interrupted && failure === null) {
        log(`dev: ${spec.name} ${message}; stopping the others`);
        failure = code || 1;
      }
      stopAll();
      if (running.size === 0) {
        for (const signal of signals) process.off(signal, onSignal);
        resolve(interrupted ? 0 : (failure ?? 1));
      }
    };

    // Register every child before any can end, so an early exit sees the others.
    const started = specs.map((spec) => {
      const child = spawn(spec.command, spec.args, {
        env: spec.env,
        cwd: spec.cwd,
        stdio: "inherit",
      });
      running.add(child);
      return { child, spec };
    });
    for (const { child, spec } of started) {
      child.once("error", (error) =>
        ended(child, spec, `could not start (${error.message})`, 1),
      );
      child.once("exit", (code, signal) =>
        ended(child, spec, `exited (${signal ?? code})`, code ?? 1),
      );
    }
  });
}
