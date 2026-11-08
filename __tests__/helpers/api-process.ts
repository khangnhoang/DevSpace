import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apiDatabaseUrl } from "./api-role";
import { recordsSince, type GuardRecord } from "./e2e-server";

const root = fileURLToPath(new URL("../..", import.meta.url));
const GUARD = join(root, "__tests__", "e2e", "server-guard.cjs");

// The stack the API tests run against: the test stack's own URLs and keys (api/global-setup.ts reads them after the
// host and Docker identity checks).
export type ApiStack = {
  apiUrl: string;
  dbUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

// Every variable the API reads. Each is set here, never inherited, so a shell that holds hosted values cannot reach
// an API under test.
export function apiTestEnv(
  stack: ApiStack,
  overrides: Record<string, string | undefined> = {},
) {
  return {
    DATABASE_URL: apiDatabaseUrl(stack.dbUrl),
    SUPABASE_URL: stack.apiUrl,
    SUPABASE_ANON_KEY: stack.anonKey,
    ALLOWED_ORIGINS: "http://127.0.0.1:3100",
    RAILWAY_GIT_COMMIT_SHA: "api-test",
    ...overrides,
  };
}

export async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export type RunningApi = {
  url: string;
  port: number;
  // The records of what the network guard refused since the process started.
  refusals(): GuardRecord[];
  output(): string;
  // Ends the process and fails when the guard refused anything the test did not expect.
  stop(options?: { expectRefusals?: boolean }): Promise<GuardRecord[]>;
};

type Spawned = {
  child: ChildProcess;
  output: () => string;
  refusals: () => GuardRecord[];
  exited: Promise<number | null>;
  dispose: () => void;
};

function spawnApi(
  env: Record<string, string | undefined>,
  port: number,
): Spawned {
  const dir = mkdtempSync(join(tmpdir(), "devspace-api-test-"));
  const guardFile = join(dir, "guard.jsonl");
  writeFileSync(guardFile, "");
  const inherited = { ...process.env };
  // Only the variables set below reach the API; the writer preload (NODE_OPTIONS) is kept so the process is
  // registered as a writer of the run (plan G8).
  for (const name of [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "ALLOWED_ORIGINS",
    "API_PROOF_ENABLED",
    "API_PROOF_USER_ID",
    "PORT",
    "HOST",
  ]) {
    delete inherited[name];
  }
  const guard = GUARD.replaceAll("\\", "/");
  const child = spawn(
    process.execPath,
    [join(root, "dist", "backend", "src", "main.js")],
    {
      cwd: root,
      env: {
        ...inherited,
        NODE_OPTIONS:
          `${process.env.NODE_OPTIONS ?? ""} --require "${guard}"`.trim(),
        E2E_GUARD_FILE: guardFile,
        HOST: "127.0.0.1",
        PORT: String(port),
        ...Object.fromEntries(
          Object.entries(env).filter(([, value]) => value !== undefined),
        ),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let text = "";
  child.stdout?.on("data", (chunk) => (text += String(chunk)));
  child.stderr?.on("data", (chunk) => (text += String(chunk)));
  const exited = new Promise<number | null>((resolve) =>
    child.once("exit", (code) => resolve(code)),
  );
  return {
    child,
    output: () => text,
    refusals: () => recordsSince<GuardRecord>(guardFile, 0),
    exited,
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function waitUntilListening(
  port: number,
  spawned: Spawned,
  timeoutMs = 30_000,
) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (spawned.child.exitCode !== null)
      throw new Error(
        `The API exited with code ${spawned.child.exitCode} before it listened:\n${spawned.output()}`,
      );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `The API did not listen within ${timeoutMs} ms:\n${spawned.output()}`,
  );
}

// Starts the built API (dist/backend/src/main.js, which `npm test` builds first) under the network guard.
export async function startApi(
  env: Record<string, string | undefined>,
): Promise<RunningApi> {
  const port = await freePort();
  const spawned = spawnApi(env, port);
  try {
    await waitUntilListening(port, spawned);
  } catch (error) {
    spawned.child.kill();
    await spawned.exited;
    spawned.dispose();
    throw error;
  }
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    refusals: spawned.refusals,
    output: spawned.output,
    async stop(options = {}) {
      spawned.child.kill();
      await spawned.exited;
      const refusals = spawned.refusals();
      spawned.dispose();
      if (refusals.length > 0 && !options.expectRefusals) {
        throw new Error(
          `The network guard refused the API: ${refusals.map((record) => `${record.kind} ${record.host}`).join(", ")}`,
        );
      }
      return refusals;
    },
  };
}

// For a configuration the API must refuse at startup: waits for the exit and returns its code and output.
export async function runApiToExit(
  env: Record<string, string | undefined>,
): Promise<{ code: number | null; output: string; listened: boolean }> {
  const port = await freePort();
  const spawned = spawnApi(env, port);
  const timer = setTimeout(() => spawned.child.kill(), 30_000);
  const code = await spawned.exited;
  clearTimeout(timer);
  const output = spawned.output();
  spawned.dispose();
  return { code, output, listened: /successfully started/.test(output) };
}
