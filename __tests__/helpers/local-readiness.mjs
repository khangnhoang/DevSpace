import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';

export function localTarget(stack, cwd) {
  const config = readFileSync(join(cwd, 'supabase/config.toml'), 'utf8');
  // The test stack names its project itself; the dev stack's comes from the checkout's own config.
  const project = stack.project ?? /^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m.exec(config)?.[1];
  if (!project) throw new Error('Cannot establish local project identity');
  const db = new URL(stack.dbUrl);
  const api = new URL(stack.apiUrl);
  const context = execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!/^(npipe:|unix:)/.test(context)) throw new Error('Docker context is not a local engine');
  const inspect = (name) => {
    const out = execFileSync('docker', ['inspect', name, '--format', '{{json .NetworkSettings.Ports}}|{{.Id}}|{{.State.Running}}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('|');
    if (out[2] !== 'true') throw new Error(`Local container ${name} is not running`);
    return { ports: JSON.parse(out[0]), id: out[1] };
  };
  const database = inspect(`supabase_db_${project}`);
  const gateway = inspect(`supabase_kong_${project}`);
  if (!database.ports['5432/tcp']?.some(p => p.HostPort === db.port) || !gateway.ports['8000/tcp']?.some(p => p.HostPort === api.port)) throw new Error('Local status endpoints do not match the intended Docker stack');
  return { endpoint: `127.0.0.1:${db.port}${db.pathname}`, project, database: database.id, gateway: gateway.id, api: api.origin.replace('localhost', '127.0.0.1') };
}

export async function assertUnmanagedReadiness(stack, ports = [3000, 3100]) {
  // This is cooperative coordination, not machine isolation. Ports catch direct dev/start/manual browser
  // usage; SQL connections catch direct database clients. Neither authorizes resetting unexpected data.
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', () => reject(new Error(`Port ${port} is in use; establish unmanaged dev/manual QA ownership before proceeding`)));
      server.listen(port, '127.0.0.1', () => server.close(resolve));
    });
  }
  const db = new pg.Client({ connectionString: stack.dbUrl, application_name: 'devspace-readiness' });
  await db.connect();
  try {
    const { rows } = await db.query(`select pid from pg_stat_activity where backend_type = 'client backend' and pid <> pg_backend_pid()
      and not (usename in ('authenticator', 'supabase_auth_admin', 'supabase_storage_admin')
      or (usename = 'supabase_admin' and (application_name like '%realtime%' or application_name = 'postgres_exporter'))) `);
    if (rows.length) throw new Error(`Unmanaged SQL connections exist (PIDs ${rows.map(r => r.pid).join(', ')}); establish exclusive disposable use`);
  } finally { await db.end(); }
}
