import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalStack } from '../../__tests__/helpers/local-stack.ts';
import { localTarget } from '../../__tests__/helpers/local-readiness.mjs';
import { coordinationRoot, targetKey, inspectRun, alive } from '../../__tests__/helpers/run-ownership.mjs';
import { recoverOwnedRun } from './recovery.mjs';

try {
  const [command, run, ...extra] = process.argv.slice(2);
  if (!['inspect', 'apply'].includes(command) || !/^[a-f0-9-]{36}$/.test(run ?? '') || extra.length) throw new Error('Usage: node scripts/test-data/recover.mjs inspect|apply <exact-run-uuid>');
  const stack = readLocalStack(process.cwd());
  const target = localTarget(stack, process.cwd());
  const owner = JSON.parse(readFileSync(join(coordinationRoot, targetKey(target), 'owner.json'), 'utf8'));
  if (owner.run !== run) throw new Error('Requested run is not the target owner; no cleanup performed');
  const state = inspectRun(owner);
  if (command === 'inspect') {
    console.log(JSON.stringify({ ...state, ownerAlive: alive(owner.pid), writers: state.members.map(member => ({ pid: member.pid, alive: alive(member.pid) })) }, null, 2));
  } else {
    await recoverOwnedRun(owner, stack);
    console.log(`Recovered only recorded resources of ${run} on ${target.project} (${target.endpoint})`);
  }
} catch (error) {
  console.error(`fixture recovery: ${error.message}`);
  if (error instanceof AggregateError) for (const cause of error.errors) console.error(`  ${cause.message}`);
  process.exitCode = 1;
}
