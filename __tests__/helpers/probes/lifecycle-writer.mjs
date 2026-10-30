import { createClient } from '@supabase/supabase-js';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalStack } from '../local-stack.ts';
import { FixtureScope, checked } from '../fixture-ownership.ts';
import { inheritedRun } from '../run-ownership.mjs';

const stack = readLocalStack(process.cwd());
const db = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const scope = new FixtureScope(inheritedRun(), db, stack.dbUrl);
const first = scope.label('rls-test first side effect');
const later = scope.label('rls-test later notification');
await scope.reserve('notifications', { title: first });
await scope.reserve('notifications', { title: later });
const server = createServer(async (_request, response) => {
  checked(await db.from('notifications').insert({ receiver_id: '11111111-1111-4111-8111-111111111111', title: first, type: 'system' }));
  console.log(JSON.stringify({ phase: 'first-written', first, later }));
  // A deterministic barrier sits between two real writes in the same tracked HTTP lifecycle.
  while (!existsSync(join(process.argv[2], 'continue'))) await new Promise(resolve => setTimeout(resolve, 25));
  checked(await db.from('notifications').insert({ receiver_id: '11111111-1111-4111-8111-111111111111', title: later, type: 'system' }));
  response.end('settled');
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ phase: 'listening', port: server.address().port, scope: scope.id })));
