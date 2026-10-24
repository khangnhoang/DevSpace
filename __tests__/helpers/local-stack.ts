import { execSync } from "node:child_process";

export type LocalStack = {
  apiUrl: string;
  dbUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

// The host must be exactly a loopback name: `http://127.0.0.1.evil.example` and any hosted Supabase
// URL have other hostnames and are refused.
export function assertLocalUrl(label: string, value: string, protocols: string[]): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `${label} is not a valid URL. This command runs only against the local Supabase stack (npx supabase start).`,
    );
  }
  if (!protocols.includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `${label} points at "${url.hostname}", not the local Supabase stack. ` +
        "This command runs only against 127.0.0.1 or localhost (npx supabase start).",
    );
  }
  return value;
}

// Reads `npx supabase status -o json`. Both URLs are checked here, before the caller can create a client.
export function parseLocalStack(statusJson: string): LocalStack {
  let status: Record<string, unknown>;
  try {
    status = JSON.parse(statusJson);
  } catch {
    throw new Error("npx supabase status did not return JSON. Is the local Supabase stack running (npx supabase start)?");
  }
  const text = (key: string) => (typeof status[key] === "string" ? (status[key] as string) : "");

  const apiUrl = assertLocalUrl("The API URL from supabase status", text("API_URL"), ["http:", "https:"]);
  const dbUrl = assertLocalUrl("The database URL from supabase status", text("DB_URL"), ["postgresql:", "postgres:"]);
  const anonKey = text("ANON_KEY");
  const serviceRoleKey = text("SERVICE_ROLE_KEY");
  if (!anonKey || !serviceRoleKey) {
    throw new Error("supabase status reported no anon or service role key from the local Supabase stack.");
  }
  return { apiUrl, dbUrl, anonKey, serviceRoleKey };
}

export function readLocalStack(cwd: string): LocalStack {
  let output: string;
  try {
    output = execSync("npx supabase status -o json", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? "").trim();
    throw new Error(
      "The local Supabase stack is not running, so this command cannot start. " +
        `Run npx supabase start and npx supabase db reset first.${stderr ? ` CLI said: ${stderr}` : ""}`,
    );
  }
  return parseLocalStack(output);
}
