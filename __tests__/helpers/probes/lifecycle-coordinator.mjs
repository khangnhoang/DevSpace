import { spawn } from 'node:child_process';
import { readTestStack } from '../../../scripts/test-stack/read.mjs';
import { localTarget } from '../local-readiness.mjs';
import { acquireRun, runEnvironment } from '../run-ownership.mjs';
import { fileURLToPath } from 'node:url';

// A private coordination directory lets the RLS probe hold the real outer suite lock throughout this
// experiment. Contenders inside the experiment use the same real target and the normal protocol.
const root = process.argv[2];
if (!root) throw new Error('Probe requires its owned coordination directory');
const ref = acquireRun(localTarget(readTestStack(process.cwd()), process.cwd()), 'lifecycle-probe', root);
console.log(JSON.stringify({ phase: 'owner', ref }));
const writer = spawn(process.execPath, [fileURLToPath(new URL('./lifecycle-writer.mjs', import.meta.url)), root], { env: runEnvironment(ref), stdio: ['ignore', 'inherit', 'inherit'] });
writer.on('exit', code => { process.exitCode = code ?? 1; });
