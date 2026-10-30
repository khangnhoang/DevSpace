import { spawn } from 'node:child_process';
import { acquireRun, releaseRun, runEnvironment, closeRun, inspectRun, alive } from './run-ownership.mjs';
import { localTarget, assertUnmanagedReadiness } from './local-readiness.mjs';

export async function startManagedRun(stack, mode, cwd = process.cwd()) {
  const target = localTarget(stack, cwd);
  const ref = acquireRun(target, mode);
  try { await assertUnmanagedReadiness(stack); }
  catch (error) { releaseRun(ref); throw error; }
  return ref;
}

export async function runManagedChild(ref, args, env = process.env) {
  const child = spawn(process.execPath, args, { env: runEnvironment(ref, env), stdio: 'inherit' });
  const signals = ['SIGINT', 'SIGTERM'];
  const handlers = signals.map(signal => {
    const handler = () => child.kill(signal);
    process.on(signal, handler);
    return handler;
  });
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    signals.forEach((signal, index) => process.off(signal, handlers[index]));
    // A child exit is not evidence that its descendants/requests settled. releaseRun checks their ledger.
    closeRun(ref);
    const deadline = Date.now() + 10_000;
    const writersRemain = () => inspectRun(ref).members.some(member => {
      if (member.pid === process.pid) return false;
      try { return alive(member.pid); }
      catch { return true; } // A transient Windows exit/permission state is uncertainty, never absence.
    });
    while (writersRemain() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    releaseRun(ref);
  }
}
