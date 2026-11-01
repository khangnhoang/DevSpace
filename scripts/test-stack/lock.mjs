// The machine-wide lock of the test stack, the writer records of a run, and the stop of writers a dead run
// left behind. Container names are machine-wide, so all of it lives in one directory outside the checkout:
//
//   lock.<generation>.json  holder PID and identity, run id, checkout, command. The highest generation is the
//                           current lock; a command takes it, or takes over a stale or released one, by
//                           hard-linking a fully written file to lock.<n+1>.json, which fails if that name
//                           exists. Nothing is renamed over another command's lock, and a crash never leaves a
//                           partial lock.
//   released.<generation>   the holder's release mark.
//   writers/<run>-<pid>-<start>.json  one record per process that writes to the stack or starts such a process.
//   unclean/<run>.json      the first cause that made the run unclean, visible to every process of the run.
//   closed/<run>            admission mark: once the launcher has seen the run's last child exit and starts the
//                           final writer wait and audit, no new process may join the run.
//
// A process is judged by PID plus its start time, never by PID alone (G4): a reused PID neither keeps a lock
// forever nor gets an unrelated process killed.
import { spawnSync, execFileSync } from "node:child_process";
import { linkSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { stateDir } from "./state.mjs";

export class LockError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LockError";
    this.code = code; // "held" | "unreadable" | "lost" | "writer-alive"
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Linux: the state letter (field 3) and the start time (field 22) of a /proc/<pid>/stat text. The command name in
// field 2 may contain spaces and parentheses, so the fields are counted from its last closing parenthesis.
export function parseProcStat(text) {
  const fields = text.slice(text.lastIndexOf(")") + 2).split(" ");
  return { state: fields[0], start: fields[19] };
}

export function pidAlive(pid) {
  try { process.kill(pid, 0); }
  catch (error) {
    // EPERM: the process exists but belongs to someone else
    return error.code !== "ESRCH";
  }
  // A killed child stays a zombie until its parent reaps it, and signal 0 still succeeds on it; it has exited.
  if (process.platform === "linux") {
    try { if (parseProcStat(readFileSync(`/proc/${pid}/stat`, "utf8")).state === "Z") return false; }
    catch (error) { if (error.code === "ENOENT") return false; }
  }
  return true;
}

// The start time of a process, as an opaque string; null only when the process does not exist. A live process
// whose start time cannot be read throws, so an uncertain identity never reads as a dead holder.
// Called once per process at registration and at takeover, never in a wait loop (about 0.5 s on Windows).
export function processStart(pid) {
  if (!pidAlive(pid)) return null;
  if (process.platform === "win32") {
    const script = `$p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue; if ($p) { $p.StartTime.ToFileTimeUtc() }`;
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    if (out) return out;
  } else if (process.platform === "linux") {
    try {
      return parseProcStat(readFileSync(`/proc/${pid}/stat`, "utf8")).start;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  } else {
    const out = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim();
    if (out) return out;
  }
  if (!pidAlive(pid)) return null;
  throw new Error(`Cannot read the start time of live process ${pid}, so its identity is not established.`);
}

export function isLive(record) {
  return Boolean(record) && pidAlive(record.pid) && processStart(record.pid) === record.start;
}

function killProcess(pid) {
  // No tree kill: a descendant that was not recorded is never stopped with its parent (G4).
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" });
  else { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
}

// ---- lock ----

const lockFile = (dir, generation) => join(dir, `lock.${generation}.json`);
const releasedFile = (dir, generation) => join(dir, `released.${generation}`);

function listGenerations(dir) {
  let names;
  try { names = readdirSync(dir); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  return names.map((name) => /^lock\.(\d+)\.json$/.exec(name)).filter(Boolean).map((match) => Number(match[1])).sort((a, b) => a - b);
}

const highestGeneration = (dir) => listGenerations(dir).at(-1) ?? 0;

function readHolder(dir, generation) {
  const file = lockFile(dir, generation);
  let text;
  try { text = readFileSync(file, "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw new LockError("unreadable", `The test stack lock file ${file} cannot be read (${error.code ?? error.message}). Nothing was changed; check the file's permissions or whether another account owns it.`);
  }
  try {
    const holder = JSON.parse(text);
    if (holder && Number.isSafeInteger(holder.pid) && typeof holder.start === "string" && typeof holder.runId === "string") return holder;
  } catch { /* reported below */ }
  throw new LockError("unreadable", `The test stack lock file ${file} cannot be parsed. Nothing was changed; check the file, and if no test command is running, stop the stale holder it names or ask the Owner before removing it.`);
}

// The current lock: the highest generation that is still readable. A generation pruned between the listing and
// the read is retried.
export function currentLock(dir = stateDir()) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const generation = highestGeneration(dir);
    if (!generation) return null;
    const holder = readHolder(dir, generation);
    if (holder) return { generation, holder, released: existsMark(releasedFile(dir, generation)) };
  }
  return null;
}

function existsMark(file) {
  try { readFileSync(file); return true; } catch { return false; }
}

export function holdsLock(dir, runId) {
  const lock = currentLock(dir);
  return Boolean(lock) && !lock.released && lock.holder.runId === runId;
}

// `afterRead` is a seam for the rows that pause a contender between reading a stale lock and claiming it.
/** @param {{ command?: string, dir?: string, checkout?: string, runId?: string, afterRead?: () => void }} [options] */
export function acquireLock({ command, dir = stateDir(), checkout = process.cwd(), runId = randomUUID(), afterRead } = {}) {
  mkdirSync(dir, { recursive: true });
  const lock = currentLock(dir);
  const base = lock?.generation ?? 0;
  let tookOver = null;
  if (lock && !lock.released) {
    if (isLive(lock.holder)) {
      throw new LockError("held", `Another test command holds the test stack lock: PID ${lock.holder.pid} running "${lock.holder.command}" in ${lock.holder.checkout}. Wait for it to finish; nothing was changed.`);
    }
    tookOver = { generation: lock.generation, holder: lock.holder };
  }
  afterRead?.();

  const generation = base + 1;
  const holder = { generation, runId, pid: process.pid, start: processStart(process.pid), command, checkout, acquiredAt: new Date().toISOString() };
  const temp = join(dir, `tmp.${runId}.json`);
  writeFileSync(temp, JSON.stringify(holder, null, 2), { flag: "wx" });
  let linked = false;
  try {
    linkSync(temp, lockFile(dir, generation));
    linked = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  } finally {
    rmSync(temp, { force: true });
  }
  if (!linked) throw new LockError("lost", "Another test command took the test stack lock first. Nothing was changed; run the command again when it has finished.");
  // A pruned generation number can be claimed again by a command that read an older lock. That claim is
  // not the current lock: the highest generation is. It removes its own file and refuses.
  if (highestGeneration(dir) !== generation) {
    rmSync(lockFile(dir, generation), { force: true });
    throw new LockError("lost", "Another test command took the test stack lock first. Nothing was changed; run the command again when it has finished.");
  }
  for (const name of readdirSync(dir)) {
    const match = /^(?:lock\.(\d+)\.json|released\.(\d+))$/.exec(name);
    if (match && Number(match[1] ?? match[2]) < generation) rmSync(join(dir, name), { force: true });
  }
  return { ...holder, dir, tookOver };
}

export function releaseLock(lock) {
  // Only the current lock is released; a lock that was lost is not this command's to mark.
  if (highestGeneration(lock.dir) !== lock.generation) return;
  try { writeFileSync(releasedFile(lock.dir, lock.generation), "", { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
}

// ---- writers ----

const writersDir = (dir) => join(dir, "writers");
const safe = (value) => String(value).replace(/[^0-9A-Za-z]/g, "_");

// A writer records itself, then checks that its run still holds the lock, and only then writes or spawns. A
// new holder publishes its lock before it scans the records, so a process that passed this check has a
// record that scan sees, and one that did not exits without writing.
/** @param {{ dir?: string, runId?: string, role?: string, start?: string }} [options] */
export function registerWriter({ dir = stateDir(), runId = process.env.DEVSPACE_TEST_RUN, role, start } = {}) {
  if (!runId) throw new LockError("lost", "No test run is active for this process (DEVSPACE_TEST_RUN is not set). Run it through npm test or npm run test:e2e.");
  const own = start ?? processStart(process.pid);
  mkdirSync(writersDir(dir), { recursive: true });
  const file = join(writersDir(dir), `${runId}-${process.pid}-${safe(own)}.json`);
  writeFileSync(file, JSON.stringify({ runId, pid: process.pid, start: own, role, registeredAt: new Date().toISOString() }), { flag: "wx" });
  if (!holdsLock(dir, runId)) throw new LockError("lost", `This process's test run ${runId} no longer holds the test stack lock, so it writes nothing. A newer test command owns the stack.`);
  // The launcher writes the mark and then scans the records, and a writer publishes its record and then reads the
  // mark: a writer that read "open" has a record the scan sees, and one that read "closed" exits without writing.
  if (admissionClosed(dir, runId)) throw new LockError("lost", `This process's test run ${runId} is already finishing, so it no longer admits writers and this process writes nothing. A process that outlives the command that started it cannot join a run late.`);
  return file;
}

const closedFile = (dir, runId) => join(dir, "closed", runId);

function admissionClosed(dir, runId) {
  try { readFileSync(closedFile(dir, runId)); return true; } catch { return false; }
}

// The launcher closes admission once the suite's process has exited and before it waits for the run's writers,
// audits the database and publishes its state; the lock stays held until after the state write.
export function closeAdmission({ dir = stateDir(), runId }) {
  mkdirSync(join(dir, "closed"), { recursive: true });
  try { writeFileSync(closedFile(dir, runId), "", { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
}

function readWriters(dir) {
  let names;
  try { names = readdirSync(writersDir(dir)); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  return names.filter((name) => name.endsWith(".json")).map((name) => {
    const file = join(writersDir(dir), name);
    try {
      const record = JSON.parse(readFileSync(file, "utf8"));
      return Number.isSafeInteger(record.pid) && typeof record.start === "string" ? { file, record } : { file, record: null };
    } catch { return { file, record: null }; }
  });
}

// Stops every recorded writer of earlier runs whose identity still matches a live process, waits until it has
// exited, and scans again until a scan finds none alive; only then are the records deleted. A writer that
// cannot be stopped throws, and its records stay. The waits are asynchronous so that a stopped child of this very
// process is reaped by the event loop while it waits.
export async function reapOrphans({ dir = stateDir(), waitMs = 10_000, stop = killProcess } = {}) {
  const stopped = [];
  for (let round = 0; round < 50; round++) {
    const entries = readWriters(dir);
    // A record that is still being written reads as unparseable; give it a moment before it counts as junk.
    if (entries.some((entry) => !entry.record) && round < 3) { await sleep(50); continue; }
    const live = entries.filter((entry) => isLive(entry.record));
    if (!live.length) {
      for (const entry of entries) rmSync(entry.file, { force: true });
      return stopped;
    }
    for (const { record } of live) {
      if (!isLive(record)) continue; // the identity is verified right before each stop
      stop(record.pid);
      stopped.push(record);
    }
    const deadline = Date.now() + waitMs;
    while (live.some(({ record }) => pidAlive(record.pid)) && Date.now() < deadline) await sleep(25);
    const stuck = live.find(({ record }) => isLive(record));
    if (stuck) throw new LockError("writer-alive", `Writer process ${stuck.record.pid} (${stuck.record.role ?? "writer"} of an earlier test run) could not be stopped. No reset or test ran; stop that process yourself, then run the command again.`);
  }
  throw new LockError("writer-alive", "Writers of earlier test runs keep appearing. No reset or test ran; check what starts them, then run the command again.");
}

// End of a run: waits, up to the deadline, for every writer of the run other than the caller to exit. Liveness is
// checked by PID while waiting; identity is confirmed once, for the survivors, at the end.
/** @param {{ dir?: string, runId?: string, timeoutMs?: number, pollMs?: number }} [options] */
export async function awaitRunWriters({ dir = stateDir(), runId, timeoutMs = 30_000, pollMs = 50 } = {}) {
  const others = () => readWriters(dir).filter((entry) => entry.record?.runId === runId && entry.record.pid !== process.pid);
  const deadline = Date.now() + timeoutMs;
  while (others().some((entry) => pidAlive(entry.record.pid)) && Date.now() < deadline) await sleep(pollMs);
  return others().filter((entry) => pidAlive(entry.record.pid) && isLive(entry.record)).map((entry) => entry.record);
}

export function clearRunWriters({ dir = stateDir(), runId }) {
  for (const entry of readWriters(dir)) if (entry.record?.runId === runId) rmSync(entry.file, { force: true });
}

// ---- unclean marks ----

const uncleanFile = (dir, runId) => join(dir, "unclean", `${runId}.json`);

export function markUnclean({ dir = stateDir(), runId, cause }) {
  mkdirSync(join(dir, "unclean"), { recursive: true });
  try { writeFileSync(uncleanFile(dir, runId), JSON.stringify({ cause, at: new Date().toISOString() }), { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; } // the first cause stays
}

export function uncleanCause({ dir = stateDir(), runId }) {
  let text;
  try { text = readFileSync(uncleanFile(dir, runId), "utf8"); }
  catch (error) { return error.code === "ENOENT" ? null : `the unclean mark cannot be read (${error.code ?? error.message})`; }
  try { return JSON.parse(text).cause ?? "unspecified cause"; } catch { return "the unclean mark cannot be parsed"; }
}

// Marks left by earlier runs are history once the next command holds the lock.
export function clearOldRunMarks({ dir = stateDir(), keep }) {
  for (const [folder, kept] of [["unclean", `${keep}.json`], ["closed", keep]]) {
    let names;
    try { names = readdirSync(join(dir, folder)); } catch { continue; }
    for (const name of names) if (name !== kept) rmSync(join(dir, folder, name), { force: true });
  }
}

// The run a process belongs to, from the environment the launcher gives its children (the run id and the
// directory it chose). Null outside a run.
/** @param {Record<string, string | undefined>} [env] */
export function runContext(env = process.env) {
  return env.DEVSPACE_TEST_RUN ? { dir: env.DEVSPACE_TEST_RUN_DIR ?? stateDir(), runId: env.DEVSPACE_TEST_RUN } : null;
}

// The entry points that write to the test stack (the rls global setup, the Playwright config) call this first, so
// a direct `vitest` or `playwright test` is refused before it reads the stack, starts a server or writes. It
// checks the fixed production directory, never a directory from the environment: the run must hold the current
// lock there, and this process must have registered itself as a writer of that run.
/** @param {{ command: string, env?: Record<string, string | undefined>, dir?: string }} options */
export function requireActiveRun({ command, env = process.env, dir = stateDir() }) {
  const refuse = (why) => { throw new LockError("lost", `${why} Run it through ${command}, which takes the test stack lock and starts the test stack.`); };
  const runId = env.DEVSPACE_TEST_RUN;
  if (!runId) refuse("No test run is active for this process, so it would write to the test stack without the lock.");
  if (!holdsLock(dir, runId)) refuse(`Test run ${runId} does not hold the test stack lock.`);
  // The file name alone proves nothing: a process that reused the PID of an exited worker inherits the run id and
  // would find that worker's record. Read it and compare the identity with this process.
  const prefix = `${runId}-${process.pid}-`;
  let names = [];
  try { names = readdirSync(writersDir(dir)).filter((name) => name.startsWith(prefix) && name.endsWith(".json")); } catch { /* no records */ }
  if (!names.length) refuse("This process is not registered as a writer of the test run.");
  let problem = "";
  for (const name of names) {
    let record;
    try { record = JSON.parse(readFileSync(join(writersDir(dir), name), "utf8")); }
    catch { problem ||= `The writer record ${name} cannot be read or parsed.`; continue; }
    if (!record || record.runId !== runId || record.pid !== process.pid || typeof record.start !== "string") { problem ||= `The writer record ${name} is malformed.`; continue; }
    if (record.start === processStart(process.pid)) return;
    problem ||= `The writer record ${name} belongs to an earlier process with the same PID, not to this one.`;
  }
  refuse(problem);
}
