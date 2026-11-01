// What the test commands remember between runs: the hash of the inputs at the last reset and whether the last
// run finished cleanly. It lives outside the checkout because the containers it describes are machine-wide.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function stateDir() {
  if (process.env.DEVSPACE_TEST_STACK_DIR) return process.env.DEVSPACE_TEST_STACK_DIR;
  const base = process.platform === "win32" ? process.env.ProgramData || "C:\\ProgramData" : "/var/tmp";
  return join(base, "devspace-test-stack-v1");
}

// A missing file is a first run. An unreadable one is an unclean state: the reset it forces is the safe answer.
export function readState(dir = stateDir()) {
  let text;
  try { text = readFileSync(join(dir, "state.json"), "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    return { status: "dirty", cause: `state.json cannot be read (${error.code ?? error.message})` };
  }
  try {
    const state = JSON.parse(text);
    if (state && typeof state === "object") return state;
  } catch { /* falls through to the unclean answer */ }
  return { status: "dirty", cause: "state.json cannot be parsed" };
}

export function clearState(dir = stateDir()) {
  rmSync(join(dir, "state.json"), { force: true });
}

export function writeState(state, dir = stateDir()) {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, "state.json");
  const temp = `${target}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(state, null, 2));
  renameSync(temp, target);
}
