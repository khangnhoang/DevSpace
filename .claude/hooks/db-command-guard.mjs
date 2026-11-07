// PreToolUse hook (TM-U1, TM-F6): asks the Owner before a tool call that may reach the hosted Supabase project.
// It reads the hook payload from stdin, lets scripts/agent-guard/db-command.mjs decide and prints the decision.
// The settings entry sets `onFailure: "block"`, so a crash, a timeout or invalid output blocks the call; this
// script also exits 2 itself on a payload it cannot read. It uses only Node built-ins, so it runs on any Node
// the hook's shell resolves (fnm selects Node per shell, and the app's shell may have the system one).
//
// Fault switch, for the live proof of fail-closed behavior: a gitignored `.fault` file next to this script.
// Absent or empty means normal. `crash`, `sleep` and `invalid` make the hook fail; any other value crashes too.
// No value ever allows a call.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classify } from "../../scripts/agent-guard/db-command.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

function readFault() {
  try {
    return readFileSync(resolve(here, ".fault"), "utf8").trim();
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error; // an unreadable switch fails closed
  }
}

function fail(message) {
  process.stderr.write(`db-command-guard: ${message}\n`);
  process.exit(2);
}

try {
  const fault = readFault();
  if (fault === "sleep") {
    await new Promise((done) => setTimeout(done, 10 * 60 * 1000));
  } else if (fault === "invalid") {
    // Starts like JSON and is not: the app must treat it as a failure, not as plain text to ignore.
    process.stdout.write('{"hookSpecificOutput": ');
    process.exit(0);
  } else if (fault) {
    fail(`fault switch "${fault}"`);
  }

  const raw = readFileSync(0, "utf8");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    fail("stdin is not valid JSON");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    fail("stdin is not a JSON object");

  const { decision, reason } = classify({
    tool_name: payload.tool_name,
    tool_input: payload.tool_input,
    cwd: typeof payload.cwd === "string" ? payload.cwd : undefined,
    root,
  });
  if (decision === "ask") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `DevSpace guard: ${reason}. Confirming here is not a grant; AGENTS.md section 4 decides what may run.`,
        },
      }),
    );
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
