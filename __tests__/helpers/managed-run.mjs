import { spawn } from 'node:child_process';
import { acquireRun, releaseRun, runEnvironment } from './run-ownership.mjs';
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
    releaseRun(ref);
  }
}
