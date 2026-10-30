import { createClient } from '@supabase/supabase-js';
import { isDeepStrictEqual } from 'node:util';
import { localTarget, assertUnmanagedReadiness } from '../../__tests__/helpers/local-readiness.mjs';
import { claimRecovery, releaseRun, recordRecoveryRequest, forgetEntry } from '../../__tests__/helpers/run-ownership.mjs';
import { cleanupEntries } from '../../__tests__/helpers/fixture-ownership.ts';

export async function recoverOwnedRun(ref, stack, cwd = process.cwd()) {
  if (!isDeepStrictEqual(ref.target, localTarget(stack, cwd))) throw new Error('Recovery target differs from the recorded stack; no cleanup performed');
  await assertUnmanagedReadiness(stack);
  claimRecovery(ref);
  const recoveryFetch = async (input, init) => {
    const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
    const url = new URL(input?.url ?? String(input));
    if (url.origin.replace('localhost', '127.0.0.1') !== ref.target.api) throw new Error('Recovery request targets a different API');
    if (['GET', 'HEAD'].includes(method)) return fetch(input, init);
    const id = recordRecoveryRequest(ref, url.pathname);
    const response = await fetch(input, init);
    await response.clone().arrayBuffer();
    forgetEntry(ref, id);
    return response;
  };
  const db = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: recoveryFetch } });
  await cleanupEntries(ref, db, stack.dbUrl);
  releaseRun(ref, true);
}
