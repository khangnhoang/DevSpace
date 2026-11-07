// Decides whether a Claude tool call may reach the hosted Supabase project (TM-U1, TM-F6). The hook script
// (.claude/hooks/db-command-guard.mjs) only reads stdin and prints this module's decision, so every rule here
// is a pure function of the tool name, its input and the working directory, and a unit test can reach it.
//
// The decision is "allow" or "ask". The hook never denies: the Owner confirms in the app, and the confirmation is
// not a grant (AGENTS.md section 4 owns what may run). The module sees command text only; a script that calls the
// CLI internally is out of reach. A false positive (one extra prompt) is accepted, a false negative is a defect.
import path from "node:path";

// Supabase MCP tools that write or change the hosted project. Read-only tools are not listed on purpose.
const WRITE_MCP_TOOLS = [
  "apply_migration",
  "execute_sql", // SQL text cannot be proven read-only (Owner decision 11).
  "deploy_edge_function",
  "create_branch",
  "delete_branch",
  "merge_branch",
  "rebase_branch",
  "reset_branch",
  "create_project",
  "pause_project",
  "restore_project",
];
const MCP_WRITE = new RegExp(`^mcp__.+__(?:${WRITE_MCP_TOOLS.join("|")})$`);

// libpq can take the real target from variables the command text does not show (PGHOSTADDR, PGSERVICE), so
// these ask whatever their arguments say.
const PG_TOOLS = new Set(["psql", "pg_dump", "pg_restore", "pg_dumpall"]);

// First words of a segment that read or move files and never run the argument as a command, so
// `git add supabase` or `cd supabase` is not mistaken for a CLI call. Anything else is scanned. `find`,
// `xargs`, `env` and shells are absent on purpose: they run their arguments.
const SAFE_FIRST_WORDS = new Set([
  "cd",
  "pushd",
  "popd",
  "ls",
  "dir",
  "cat",
  "type",
  "git",
  "rg",
  "grep",
  "mkdir",
  "rm",
  "rmdir",
  "cp",
  "copy",
  "mv",
  "move",
  "head",
  "tail",
  "wc",
  "stat",
  "set-location",
  "sl",
  "get-childitem",
  "gci",
  "get-content",
  "gc",
  "select-string",
  "test-path",
  "remove-item",
  "new-item",
  "copy-item",
  "move-item",
  "resolve-path",
  "join-path",
]);

// Global flags of the CLI that take a value (`supabase --help`, CLI 2.121.0), skipped when finding the subcommand.
const VALUE_FLAGS = new Set([
  "--workdir",
  "--profile",
  "--output",
  "-o",
  "--output-format",
  "--log-level",
  "--network-id",
  "--dns-resolver",
  "--agent",
]);

const ALWAYS_ASK_FLAGS = new Set(["--linked", "--db-url", "--project-ref"]);
const MAX_DEPTH = 5;

const allow = (reason = "no database command found") => ({
  decision: "allow",
  reason,
});
const ask = (reason) => ({ decision: "ask", reason });

// The program a token names: last path component, no version suffix or Windows executable extension.
function programName(token) {
  const base = token.toLowerCase().split(/[\\/]/).pop() ?? "";
  return base.replace(/@[^@]*$/, "").replace(/\.(?:exe|cmd|bat|ps1)$/, "");
}

// Splits command text into segments at `;`, `|`, `&`, parentheses, backticks and newlines outside quotes.
// A quoted string with whitespace stays one token and is also kept in `nested`, because `bash -c "..."` and
// `$(...)` inside double quotes run it as a command of its own.
function segment(text) {
  const segments = [];
  let current = { tokens: [], nested: [] };
  let token = "";
  let inToken = false;
  let quote = null;
  let quoted = "";
  const endToken = () => {
    if (inToken) current.tokens.push(token);
    token = "";
    inToken = false;
  };
  const endSegment = () => {
    endToken();
    if (current.tokens.length || current.nested.length) segments.push(current);
    current = { tokens: [], nested: [] };
  };
  for (const char of text) {
    if (quote) {
      if (char === quote) {
        quote = null;
        if (/\s/.test(quoted)) current.nested.push(quoted);
      } else {
        token += char;
        quoted += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      quoted = "";
      inToken = true;
    } else if (char === "\n" || char === "\r") {
      endSegment();
    } else if (/\s/.test(char)) {
      endToken();
    } else if (";|&()`".includes(char)) {
      endSegment();
    } else {
      token += char;
      inToken = true;
    }
  }
  if (quote && /\s/.test(quoted)) current.nested.push(quoted);
  endSegment();
  return segments;
}

const isWindowsPath = (value) => /^[a-z]:[\\/]/i.test(value);

// Git Bash spells C:\x as /c/x; the checkout root decides which path rules apply.
function toNativePath(value, windows) {
  if (!windows) return value;
  const match = /^\/([a-z])(\/.*)?$/i.exec(value);
  return match ? `${match[1]}:${match[2] ?? "/"}` : value;
}

function resolveDir(value, cwd, windows) {
  if (!value || /[$%~`*?<>|]/.test(value)) return null; // not resolvable from text alone
  const p = windows ? path.win32 : path.posix;
  const native = toNativePath(value, windows);
  if (p.isAbsolute(native)) return p.resolve(native);
  if (typeof cwd !== "string" || !cwd) return null;
  const base = toNativePath(cwd, windows);
  return p.isAbsolute(base) ? p.resolve(base, native) : null;
}

// `db reset` passes only when its single --workdir is this checkout's .supabase-test folder, the test stack.
function isTestWorkdir(args, cwd, root) {
  if (typeof root !== "string" || !root) return false;
  const values = [];
  args.forEach((arg, index) => {
    if (arg === "--workdir") values.push(args[index + 1]);
    else if (arg.startsWith("--workdir=")) values.push(arg.slice(10));
  });
  if (values.length !== 1) return false;
  const windows = isWindowsPath(toNativePath(root, true));
  const p = windows ? path.win32 : path.posix;
  const resolved = resolveDir(values[0], cwd, windows);
  const rootDir = resolveDir(root, null, windows);
  if (!resolved || !rootDir) return false;
  const expected = p.resolve(rootDir, ".supabase-test");
  return windows
    ? resolved.toLowerCase() === expected.toLowerCase()
    : resolved === expected;
}

// G2 order, first match wins; help and version go first (plan deviation: `db push --help` runs nothing).
function classifySupabase(rawArgs, { cwd, root }) {
  const args = rawArgs.map((arg) => arg.trim());
  const lower = args.map((arg) => arg.toLowerCase());
  const flagName = (arg) => (arg.startsWith("--") ? arg.split("=")[0] : arg);

  const positionals = [];
  for (let index = 0; index < lower.length; index++) {
    const arg = lower[index];
    if (arg.startsWith("-")) {
      if (VALUE_FLAGS.has(flagName(arg)) && !arg.includes("=")) index++;
    } else positionals.push(arg);
  }

  // Help and version print and exit before the CLI reads any target, so they pass even with an always-ask word.
  if (lower.some((arg) => ["--help", "-h", "--version", "-v"].includes(arg)))
    return allow("supabase help or version");

  // 1. always ask
  for (const arg of lower) {
    if (ALWAYS_ASK_FLAGS.has(flagName(arg)))
      return ask(`supabase ${flagName(arg)} can reach the hosted project`);
  }
  for (const word of ["link", "unlink", "pull"]) {
    if (positionals.includes(word))
      return ask(`supabase ${word} can reach the hosted project`);
  }
  if (
    positionals.includes("db") &&
    (positionals.includes("push") || positionals.includes("pull"))
  )
    return ask("supabase db push/pull can reach the hosted project");
  if (
    (positionals.includes("migration") || positionals.includes("migrations")) &&
    positionals.includes("repair")
  )
    return ask("supabase migration repair can reach the hosted project");

  // 2. db reset only on the test stack
  if (positionals.includes("db") && positionals.includes("reset")) {
    return isTestWorkdir(args, cwd, root)
      ? allow("supabase db reset on the test workdir")
      : ask(
          "supabase db reset outside this checkout's .supabase-test workdir (its --local does not count)",
        );
  }

  // 3. provably local
  if (lower.includes("--local")) return allow("supabase --local");
  if (["start", "stop", "status", "init"].includes(positionals[0] ?? ""))
    return allow(`supabase ${positionals[0]}`);
  if (
    ["migration", "migrations"].includes(positionals[0] ?? "") &&
    positionals[1] === "new"
  )
    return allow("supabase migration new");

  // 4. everything else
  return ask(
    "supabase command not provably local (add --local, or the Owner confirms)",
  );
}

function scan(text, context, depth) {
  if (depth > MAX_DEPTH) return ask("command nesting too deep to inspect");
  for (const { tokens, nested } of segment(text)) {
    const first = tokens[0] === undefined ? "" : programName(tokens[0]);
    if (SAFE_FIRST_WORDS.has(first)) continue;
    for (let index = 0; index < tokens.length; index++) {
      const program = programName(tokens[index]);
      if (program === "supabase") {
        context.sawSupabase = true;
        const result = classifySupabase(tokens.slice(index + 1), context);
        if (result.decision === "ask") return result;
        break;
      }
      if (PG_TOOLS.has(program)) {
        const rest = tokens
          .slice(index + 1)
          .map((token) => token.toLowerCase());
        if (rest.includes("--help") || rest.includes("--version")) break;
        return ask(
          `${program} can take its target from variables the command text does not show`,
        );
      }
    }
    for (const inner of nested) {
      const result = scan(inner, context, depth + 1);
      if (result.decision === "ask") return result;
    }
  }
  return allow();
}

function classifyCommand(command, { cwd, root }) {
  const context = { cwd, root, sawSupabase: false };
  const result = scan(command, context, 0);
  if (result.decision === "ask") return result;
  // Net for a flag that a quote or separator hid from the segment that holds the invocation.
  if (context.sawSupabase && /--(?:linked|db-url|project-ref)\b/i.test(command))
    return ask("supabase call with a hosted-target flag somewhere in the line");
  return result;
}

/**
 * @param {{ tool_name?: unknown, tool_input?: unknown, cwd?: string, root?: string }} input hook payload plus the
 * checkout root; throws on a payload it cannot read, which the hook turns into a block.
 * @returns {{ decision: "allow" | "ask", reason: string }}
 */
export function classify({ tool_name, tool_input, cwd, root } = {}) {
  if (typeof tool_name !== "string" || !tool_name)
    throw new TypeError("tool_name is missing");
  if (MCP_WRITE.test(tool_name))
    return ask(`${tool_name} writes to or changes the hosted project`);
  if (tool_name === "Bash" || tool_name === "PowerShell") {
    if (
      !tool_input ||
      typeof tool_input !== "object" ||
      typeof (/** @type {any} */ (tool_input).command) !== "string"
    )
      throw new TypeError(`${tool_name} input has no command text`);
    return classifyCommand(/** @type {any} */ (tool_input).command, {
      cwd,
      root,
    });
  }
  return allow("tool does not reach the hosted project");
}
