import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The machine-wide location comes from the OS, never TEMP/HOME/ProgramData environment overrides. A second
// account either sees the same target lock or fails on permissions; it must never get a private fallback.
const commonData = process.platform === 'win32'
  ? execFileSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('CommonApplicationData')"], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  : '/var/tmp';
if (!commonData) throw new Error('Cannot establish the machine-wide ownership directory');
export const coordinationRoot = join(commonData, 'devspace-fixture-ownership-v1');

export function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Ambiguous writer PID');
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw new Error(`Cannot establish writer lifetime for PID ${pid}`); }
}

export function targetKey(target) {
  // Endpoints, not cwd or container ID: two checkouts and a restarted stack still contend.
  return createHash('sha256').update(target.endpoint).digest('hex');
}

function atomic(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  renameSync(temp, path);
}

function read(path) { return JSON.parse(readFileSync(path, 'utf8')); }

/** @template T @param {string} dir @param {() => T} action @returns {T} */
function guarded(dir, action) {
  const gate = join(dir, 'gate');
  const until = Date.now() + 5000;
  while (true) {
    try { mkdirSync(gate); break; }
    catch (error) {
      // Windows can report EPERM while another process's removed directory is still
      // delete-pending. Retry acquisition only, with the same bounded fail-closed timeout.
      if (error.code !== 'EEXIST' && !(process.platform === 'win32' && error.code === 'EPERM')) throw error;
      if (Date.now() > until) throw new Error(`Ownership metadata busy or interrupted: ${dir}; inspect explicitly`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return action(); } finally { rmdirSync(gate); }
}

function validate(ref) {
  const dir = join(ref.root, targetKey(ref.target));
  const owner = read(join(dir, 'owner.json'));
  if (owner.run !== ref.run || JSON.stringify(owner.target) !== JSON.stringify(ref.target)) {
    throw new Error('Ownership reference does not match the recorded run/target');
  }
  return { dir, owner };
}

export function acquireRun(target, mode, root = coordinationRoot) {
  const dir = join(root, targetKey(target));
  mkdirSync(root, { recursive: true });
  try { mkdirSync(dir); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Local target already owned or unresolved: ${dir}. Inspect/recover that run explicitly; never delete its lock.`);
  }
  const ref = { root: resolve(root), run: randomUUID(), target };
  // A crash before owner.json leaves an ambiguous directory; acquisition never steals it.
  atomic(join(dir, 'owner.json'), { ...ref, pid: process.pid, mode, checkout: process.cwd(), phase: 'open' });
  mkdirSync(join(dir, 'members'));
  mkdirSync(join(dir, 'entries'));
  return ref;
}

// Caller holds the metadata gate. Public readers use the same gate as writers so
// a directory listing and its files are one snapshot, including owner phase.
function snapshotLocked(ref) {
  const { dir, owner } = validate(ref);
  const records = subdir => readdirSync(join(dir, subdir)).map(name => {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) throw new Error(`Interrupted or unknown ownership metadata: ${subdir}/${name}; inspect explicitly`);
    return read(join(dir, subdir, name));
  });
  return {
    owner,
    members: records('members'),
    entries: records('entries'),
  };
}

export function inspectRun(ref) {
  return guarded(join(ref.root, targetKey(ref.target)), () => snapshotLocked(ref));
}

export function assertRun(ref) {
  const { owner } = validate(ref);
  if (owner.phase !== 'open' || !alive(owner.pid)) throw new Error('Run no longer admits writes');
}

export function closeRun(ref) {
  const { dir } = validate(ref);
  guarded(dir, () => {
    const { owner } = validate(ref);
    if (owner.pid !== process.pid) throw new Error('Only the coordinator can close admission');
    atomic(join(dir, 'owner.json'), { ...owner, phase: 'closing' });
  });
}

export function joinRun(ref) {
  const { dir, owner: recorded } = validate(ref);
  // Resolved before the gate: on Windows ancestorPids() spawns PowerShell (about 0.5 s, more under build load),
  // and the 5 s gate bound is shared by every worker joining one after another. The owner pid never changes.
  const ancestors = recorded.pid === process.pid ? [] : ancestorPids();
  return guarded(dir, () => {
    assertRun(ref);
    const { owner } = validate(ref);
    if (owner.pid !== process.pid && !ancestors.includes(owner.pid)) throw new Error('Ownership reference belongs to another process tree');
    const id = randomUUID();
    atomic(join(dir, 'members', `${id}.json`), { id, pid: process.pid });
    return id;
  });
}

function ancestorPids() {
  if (process.platform === 'win32') {
    // Only process IDs are returned: command lines can contain credentials.
    const result = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const parents = new Map(JSON.parse(result).map(row => [row.ProcessId, row.ParentProcessId]));
    const chain = [];
    for (let pid = process.ppid; pid && !chain.includes(pid); pid = parents.get(pid)) chain.push(pid);
    return chain;
  }
  const chain = [];
  for (let pid = process.ppid; pid && !chain.includes(pid);) {
    chain.push(pid);
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  }
  return chain;
}

export function recordEntry(ref, entry) {
  const { dir } = validate(ref);
  return guarded(dir, () => {
    assertRun(ref);
    if (entry.kind === 'scope' && snapshotLocked(ref).entries.some(existing =>
      (existing.kind === 'scope' && existing.state === 'closing') || existing.kind === 'experiment')) {
      throw new Error('Previous fixture cleanup is unresolved; no new scope may acquire mutations');
    }
    if (['rows', 'restore', 'auth'].includes(entry.kind)) {
      const selector = value => JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)));
      const conflict = snapshotLocked(ref).entries.some(existing =>
        (entry.kind === 'auth' && existing.kind === 'auth' && existing.email === entry.email) ||
        (['rows', 'restore'].includes(entry.kind) && ['rows', 'restore'].includes(existing.kind) && existing.table === entry.table && selector(existing.where) === selector(entry.where)));
      if (conflict) throw new Error('Fixture selector is already reserved; do not share ownership between scopes');
    }
    const id = randomUUID();
    atomic(join(dir, 'entries', `${id}.json`), { ...entry, id });
    return id;
  });
}

export function forgetEntry(ref, id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid ownership entry ID');
  const { dir } = validate(ref);
  guarded(dir, () => { unlinkSync(join(dir, 'entries', `${id}.json`)); });
}

export function closeScope(ref, scope) {
  const { dir } = validate(ref);
  guarded(dir, () => {
    const entry = snapshotLocked(ref).entries.find(entry => entry.kind === 'scope' && entry.scope === scope);
    if (entry) atomic(join(dir, 'entries', `${entry.id}.json`), { ...entry, state: 'closing' });
  });
}

function admitScopeRequest(ref, scope, kind, path) {
  const { dir } = validate(ref);
  return guarded(dir, () => {
    assertRun(ref);
    const entry = snapshotLocked(ref).entries.find(entry => entry.kind === 'scope' && entry.scope === scope && entry.state === 'open');
    if (!entry) throw new Error('HTTP mutation has no open fixture scope');
    const id = randomUUID();
    atomic(join(dir, 'entries', `${id}.json`), { kind, scope, id, pid: process.pid, ...(path ? { path } : {}) });
    return id;
  });
}

export function admitHttp(ref, scope) { return admitScopeRequest(ref, scope, 'http'); }
export function admitBrowserRequest(ref, scope, path) { return admitScopeRequest(ref, scope, 'request', path); }

export function recordRecoveryRequest(ref, path) {
  const { dir } = validate(ref);
  return guarded(dir, () => {
    const { owner } = validate(ref);
    if (owner.phase !== 'recovering' || owner.recoveryPid !== process.pid) throw new Error('No exclusive recovery claim');
    const id = randomUUID();
    atomic(join(dir, 'entries', `${id}.json`), { kind: 'request', scope: 'recovery', pid: process.pid, id, path });
    return id;
  });
}

export function releaseRun(ref, recovery = false) {
  const { dir } = validate(ref);
  guarded(dir, () => {
    const { owner, members, entries } = snapshotLocked(ref);
    if (recovery ? alive(owner.pid) : owner.pid !== process.pid) throw new Error('Cannot release a live/foreign run');
    if (owner.recoveryPid && owner.recoveryPid !== process.pid && alive(owner.recoveryPid)) throw new Error('Another recovery owns this run');
    if (members.some(member => (recovery || member.pid !== process.pid) && alive(member.pid))) throw new Error('Writer descendants are still alive; ownership retained');
    if (entries.length) throw new Error('Unresolved ownership/request entries remain; ownership retained');
    atomic(join(dir, 'owner.json'), { ...owner, phase: 'closed' });
  });
  // Closed phase fences late preload registration before the directory disappears.
  for (const subdir of ['members', 'entries']) {
    for (const name of readdirSync(join(dir, subdir))) unlinkSync(join(dir, subdir, name));
    rmdirSync(join(dir, subdir));
  }
  unlinkSync(join(dir, 'owner.json'));
  rmdirSync(dir);
}

export function claimRecovery(ref) {
  const { dir } = validate(ref);
  guarded(dir, () => {
    const { owner, members, entries } = snapshotLocked(ref);
    if (alive(owner.pid) || members.some(member => alive(member.pid))) throw new Error('Recovery refused: owner or descendant writer is alive');
    if (owner.recoveryPid && owner.recoveryPid !== process.pid && alive(owner.recoveryPid)) throw new Error('Another recovery owns this run');
    if (entries.some(entry => entry.kind === 'request')) throw new Error('Unresolved outbound request; inspect its server/SQL outcome before recovery');
    if (entries.some(entry => !['rows', 'restore', 'auth', 'http', 'scope'].includes(entry.kind))) throw new Error('Unknown journal entry; explicit investigation required');
    atomic(join(dir, 'owner.json'), { ...owner, phase: 'recovering', recoveryPid: process.pid });
    // A dead handler cannot issue another side effect. Outbound requests above must already have settled;
    // otherwise stopping Node alone says nothing about an operation still executing in PostgREST/Auth.
    for (const entry of entries.filter(entry => entry.kind === 'http')) unlinkSync(join(dir, 'entries', `${entry.id}.json`));
  });
}
export function inheritedRun(env = process.env) {
  if (!env.DEVSPACE_OWNERSHIP) throw new Error('Use the managed local launcher; no ownership reference was supplied');
  const ref = JSON.parse(env.DEVSPACE_OWNERSHIP);
  if (!ref || typeof ref.root !== 'string' || typeof ref.run !== 'string' || !ref.target?.endpoint) throw new Error('Invalid ownership reference');
  validate(ref);
  return ref;
}

export function runEnvironment(ref, inherited = process.env) {
  assertRun(ref);
  const preload = pathToFileURL(join(inspectRun(ref).owner.checkout, '__tests__/helpers/run-preload.mjs')).href;
  return {
    ...inherited,
    DEVSPACE_OWNERSHIP: JSON.stringify(ref),
    NODE_OPTIONS: `${inherited.NODE_OPTIONS ?? ''} --import=${preload}`.trim(),
  };
}
