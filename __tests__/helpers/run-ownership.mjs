import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const coordinationRoot = join(tmpdir(), 'devspace-fixture-ownership-v1');

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

function guarded(dir, action) {
  const gate = join(dir, 'gate');
  const until = Date.now() + 5000;
  while (true) {
    try { mkdirSync(gate); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
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

export function inspectRun(ref) {
  const { dir, owner } = validate(ref);
  return {
    owner,
    members: readdirSync(join(dir, 'members')).map(name => read(join(dir, 'members', name))),
    entries: readdirSync(join(dir, 'entries')).map(name => read(join(dir, 'entries', name))),
  };
}

export function assertRun(ref) {
  const { owner } = validate(ref);
  if (owner.phase !== 'open' || !alive(owner.pid)) throw new Error('Run no longer admits writes');
}

export function joinRun(ref) {
  const { dir } = validate(ref);
  return guarded(dir, () => {
    assertRun(ref);
    const { owner } = validate(ref);
    if (owner.pid !== process.pid && !ancestorPids().includes(owner.pid)) throw new Error('Ownership reference belongs to another process tree');
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

export function releaseRun(ref, recovery = false) {
  const { dir } = validate(ref);
  guarded(dir, () => {
    const { owner, members, entries } = inspectRun(ref);
    if (recovery ? alive(owner.pid) : owner.pid !== process.pid) throw new Error('Cannot release a live/foreign run');
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

export function runDirectory(ref) { return validate(ref).dir; }
export function hasRun(ref) { return existsSync(join(ref.root, targetKey(ref.target))); }
