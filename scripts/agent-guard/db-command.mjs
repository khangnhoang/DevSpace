// Decides whether a Claude tool call may reach the hosted Supabase project (TM-U1, TM-F6). The hook script
// (.claude/hooks/db-command-guard.mjs) only reads stdin and prints this module's decision, so every rule here
// is a pure function of the tool name, its input and the working directory, and a unit test can reach it.
//
// The decision is "allow" or "ask". The hook never denies: the Owner confirms in the app, and the confirmation is
// not a grant (AGENTS.md section 4 owns what may run). The module judges the commands that will run, not text
// that mentions them: a `supabase` or `psql` token is checked only where it is the program of a command
// (through wrappers such as `npx`, `fnm exec --`, `env`), in the command string of a shell or `eval`, or in a
// command substitution. Anything else (an `echo` argument, a commit message, a heredoc body) is data. A script or
// interpreter that calls the CLI from inside code (`node -e`, `python -c`, a script file) is out of reach.
// A false positive (one extra prompt) is accepted, a false negative on a form in AC1-AC3 is a defect.
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
const MENTION = /supabase|\bpsql\b|pg_dump|pg_restore/i;

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
const MAX_DEPTH = 6;

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "ash"]);
const POWERSHELLS = new Set(["powershell", "pwsh"]);
// Words that precede a command without being one: shell keywords and prefix commands.
const PREFIX_WORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "while",
  "until",
  "do",
  "!",
  "time",
  "coproc",
  "exec",
  "sudo",
  "command",
  "nohup",
  "builtin",
  "call",
  "nice",
  "function",
]);

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

// ---------- tokenizer ----------

// End of the `)` that closes a `$(` whose body starts at `start`, skipping quoted strings; -1 when unbalanced.
function matchParen(text, start) {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const close = text.indexOf(c, i + 1);
      if (close < 0) return -1;
      i = close;
    } else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

// `$( ... )` bodies inside a string that the shell expands (a PowerShell `@" "@` here-string body).
function substitutionsIn(text) {
  const found = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === "$" && text[i + 1] === "(") {
      const end = matchParen(text, i + 2);
      if (end < 0) return null;
      found.push(text.slice(i + 2, end));
      i = end;
    }
  }
  return found;
}

/**
 * Splits command text into segments (a command and its arguments) at `;`, `|`, `&`, parentheses, braces that
 * stand alone and newlines outside quotes. Quotes are removed from tokens. `$( )` and backticks, outside single
 * quotes, are collected in `subs`. A heredoc body belongs to the segment that opened it, and a PowerShell
 * here-string is dropped except for its `$( )`. `error` names what made the text unreadable.
 * @param {string} text
 * @param {"bash" | "powershell"} flavor
 */
function parse(text, flavor) {
  const ps = flavor === "powershell";
  /** @type {{ tokens: string[], heredocs: string[], fromPipe: boolean }[]} */
  const segments = [];
  /** @type {string[]} */
  const subs = [];
  const newSegment = (fromPipe = false) => ({
    tokens: /** @type {string[]} */ ([]),
    heredocs: /** @type {string[]} */ ([]),
    fromPipe,
  });
  let seg = newSegment();
  let token = "";
  let inToken = false;
  const pending =
    /** @type {{ word: string, strip: boolean, seg: typeof seg }[]} */ ([]);
  const fail = (error) => ({ segments, subs, error });
  const endToken = () => {
    if (inToken) seg.tokens.push(token);
    token = "";
    inToken = false;
  };
  const endSegment = (fromPipe = false) => {
    endToken();
    if (seg.tokens.length || seg.heredocs.length) segments.push(seg);
    seg = newSegment(fromPipe);
  };
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];

    // PowerShell here-string: the body is data; only `$( )` in an @" "@ body runs.
    if (ps && c === "@" && !inToken && (next === "'" || next === '"')) {
      const open = /^[ \t]*\r?\n/.exec(text.slice(i + 2));
      if (open) {
        const bodyStart = i + 2 + open[0].length;
        const close = text.indexOf(`\n${next}@`, bodyStart - 1);
        if (close < 0) return fail("unterminated here-string");
        if (next === '"') {
          const inner = substitutionsIn(text.slice(bodyStart, close));
          if (inner === null) return fail("unterminated $(");
          subs.push(...inner);
        }
        inToken = true;
        i = close + 3;
        continue;
      }
    }

    if (c === "'") {
      const close = text.indexOf("'", i + 1);
      if (close < 0) return fail("unbalanced quote");
      token += text.slice(i + 1, close);
      inToken = true;
      i = close + 1;
      continue;
    }
    if (c === '"') {
      inToken = true;
      i++;
      for (;;) {
        if (i >= n) return fail("unbalanced quote");
        const d = text[i];
        if (d === '"') {
          i++;
          break;
        }
        if (!ps && d === "\\" && '"$`\\'.includes(text[i + 1] ?? "x")) {
          token += text[i + 1];
          i += 2;
        } else if (ps && d === "`") {
          token += text[i + 1] ?? "";
          i += 2;
        } else if (d === "$" && text[i + 1] === "(") {
          const end = matchParen(text, i + 2);
          if (end < 0) return fail("unterminated $(");
          subs.push(text.slice(i + 2, end));
          i = end + 1;
        } else if (!ps && d === "`") {
          const end = text.indexOf("`", i + 1);
          if (end < 0) return fail("unterminated backtick");
          subs.push(text.slice(i + 1, end));
          i = end + 1;
        } else {
          token += d;
          i++;
        }
      }
      continue;
    }
    if (c === "$" && next === "(") {
      const end = matchParen(text, i + 2);
      if (end < 0) return fail("unterminated $(");
      subs.push(text.slice(i + 2, end));
      inToken = true;
      i = end + 1;
      continue;
    }
    if (c === "`") {
      if (ps) {
        // PowerShell escape and line continuation, not a substitution.
        if (next === "\r" && text[i + 2] === "\n") i += 3;
        else if (next === "\n") i += 2;
        else {
          token += next ?? "";
          inToken = true;
          i += 2;
        }
        continue;
      }
      const end = text.indexOf("`", i + 1);
      if (end < 0) return fail("unterminated backtick");
      subs.push(text.slice(i + 1, end));
      inToken = true;
      i = end + 1;
      continue;
    }
    if (!ps && c === "\\") {
      // Only the characters the shell would treat specially are escaped; a backslash in a Windows path stays.
      if (next === "\n") i += 2;
      else if (next === "\r" && text[i + 2] === "\n") i += 3;
      else if (next !== undefined && ";&|()\"'$`<> {}#".includes(next)) {
        token += next;
        inToken = true;
        i += 2;
      } else {
        token += "\\";
        inToken = true;
        i++;
      }
      continue;
    }
    if (!ps && c === "<" && next === "<" && text[i + 2] !== "<") {
      let j = i + 2;
      const strip = text[j] === "-";
      if (strip) j++;
      while (text[j] === " " || text[j] === "\t") j++;
      let word = "";
      if (text[j] === "'" || text[j] === '"') {
        const close = text.indexOf(text[j], j + 1);
        if (close < 0) return fail("unbalanced quote");
        word = text.slice(j + 1, close);
        j = close + 1;
      } else {
        const m = /^\\?([^\s;&|()<>]+)/.exec(text.slice(j));
        if (m) {
          word = m[1];
          j += m[0].length;
        }
      }
      if (word) {
        endToken();
        pending.push({ word, strip, seg });
        i = j;
        continue;
      }
    }
    if (c === "#" && !inToken) {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "\n" || (c === "\r" && next === "\n")) {
      if (c === "\r") i++;
      endSegment();
      i++;
      for (const { word, strip, seg: owner } of pending) {
        let found = false;
        let body = "";
        while (i <= n) {
          let end = text.indexOf("\n", i);
          if (end < 0) end = n;
          let line = text.slice(i, end).replace(/\r$/, "");
          const stripped = strip ? line.replace(/^\t+/, "") : line;
          i = end + 1;
          if (stripped === word) {
            found = true;
            break;
          }
          body += `${line}\n`;
          if (end >= n) break;
        }
        if (!found) return fail("unterminated heredoc");
        owner.heredocs.push(body);
        if (!segments.includes(owner) && owner !== seg) segments.push(owner);
      }
      pending.length = 0;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      endToken();
      i++;
      continue;
    }
    if (c === ";" || c === "(" || c === ")") {
      endSegment();
      i++;
      continue;
    }
    if (c === "|") {
      if (next === "|") {
        endSegment();
        i += 2;
      } else {
        endSegment(true);
        i += next === "&" ? 2 : 1;
      }
      continue;
    }
    if (c === "&") {
      endSegment();
      i++;
      continue;
    }
    if (
      (c === "{" || c === "}") &&
      !inToken &&
      (ps || next === undefined || /[\s;]/.test(next))
    ) {
      endSegment();
      i++;
      continue;
    }
    token += c;
    inToken = true;
    i++;
  }
  if (pending.length) return fail("unterminated heredoc");
  endSegment();
  return { segments, subs, error: null };
}

// ---------- supabase rules ----------

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

// ---------- which program runs ----------

const stripFlags = (tokens, withValue = []) => {
  const rest = tokens.slice();
  while (rest.length && rest[0].startsWith("-")) {
    const flag = rest.shift();
    if (flag === "--") break;
    if (withValue.includes(flag)) rest.shift();
  }
  return rest;
};

/**
 * Removes leading assignments and wrappers (`npx`, `fnm exec --`, `npm exec --`, `env`, `time`, ...) so the
 * program that actually runs comes first. `shellText` carries a command string a wrapper hands to a shell.
 * @param {string[]} input
 * @returns {{ tokens: string[], shellText?: string }}
 */
function unwrap(input) {
  let tokens = input.slice();
  for (let guard = 0; guard < 40 && tokens.length; guard++) {
    const first = tokens[0];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(first) || first === ".") {
      tokens.shift();
      continue;
    }
    const name = programName(first);
    if (PREFIX_WORDS.has(name)) {
      tokens.shift();
      tokens = stripFlags(tokens);
      continue;
    }
    if (name === "env") {
      tokens.shift();
      while (
        tokens.length &&
        (tokens[0].startsWith("-") ||
          /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]))
      ) {
        if (tokens.shift() === "-u") tokens.shift();
      }
      continue;
    }
    if (["npx", "pnpx", "bunx"].includes(name)) {
      tokens.shift();
      while (tokens.length && tokens[0].startsWith("-")) {
        const flag = tokens.shift();
        if (flag === "--") break;
        if (flag === "-c" || flag === "--call")
          return { tokens: [], shellText: tokens.shift() };
        if (flag === "-p" || flag === "--package") tokens.shift();
      }
      continue;
    }
    if (name === "fnm") {
      if (tokens[1] !== "exec") break;
      tokens = tokens.slice(2);
      while (tokens.length && tokens[0] !== "--" && tokens[0].startsWith("-")) {
        const flag = tokens.shift();
        if (["--using", "--node-version", "--arch"].includes(flag))
          tokens.shift();
      }
      if (tokens[0] === "--") tokens.shift();
      continue;
    }
    if (["npm", "pnpm", "yarn", "bun", "corepack"].includes(name)) {
      const rest = stripFlags(tokens.slice(1));
      const sub = rest[0];
      if (["exec", "dlx", "x", "run"].includes(sub ?? "")) {
        tokens = stripFlags(rest.slice(1));
        continue;
      }
      if (name !== "npm" && sub) {
        tokens = rest;
        continue;
      }
      break;
    }
    if (name === "timeout") {
      tokens.shift();
      tokens = stripFlags(tokens, ["-s", "-k"]);
      if (/^\d/.test(tokens[0] ?? "")) tokens.shift();
      continue;
    }
    if (name === "wsl") {
      tokens.shift();
      tokens = stripFlags(tokens, ["-d", "--distribution", "-u", "--user"]);
      continue;
    }
    break;
  }
  return { tokens };
}

// `node path/to/supabase.js ...` runs the CLI through its script.
function nodeScriptIsSupabase(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      if (
        [
          "-e",
          "-p",
          "-r",
          "--eval",
          "--print",
          "--require",
          "--import",
        ].includes(arg)
      )
        i++;
      continue;
    }
    const base = (arg.toLowerCase().split(/[\\/]/).pop() ?? "").replace(
      /\.(?:c|m)?js$/,
      "",
    );
    return base === "supabase" ? i : -1;
  }
  return -1;
}

function decodeEncoded(value) {
  try {
    return Buffer.from(value ?? "", "base64").toString("utf16le");
  } catch {
    return "";
  }
}

/** Judges one command (already split into tokens). */
function analyzeTokens(
  input,
  context,
  depth,
  { heredocs = [], fromPipe = false } = {},
) {
  if (depth > MAX_DEPTH) return ask("command nesting too deep to inspect");
  const unwrapped = unwrap(input);
  if (unwrapped.shellText !== undefined)
    return scan(unwrapped.shellText, "bash", context, depth + 1);
  const tokens = unwrapped.tokens;
  if (!tokens.length) return allow();
  const program = programName(tokens[0]);
  const args = tokens.slice(1);
  const lowerArgs = args.map((arg) => arg.toLowerCase());

  if (program === "supabase") return classifySupabase(args, context);
  if (PG_TOOLS.has(program)) {
    if (lowerArgs.includes("--help") || lowerArgs.includes("--version"))
      return allow(`${program} help or version`);
    return ask(
      `${program} can take its target from variables the command text does not show`,
    );
  }
  if (program === "node") {
    const at = nodeScriptIsSupabase(args);
    if (at >= 0) return classifySupabase(args.slice(at + 1), context);
    return allow();
  }

  if (SHELLS.has(program)) {
    const at = args.findIndex((arg) => /^-[a-z]*c[a-z]*$/.test(arg));
    if (at >= 0 && args[at + 1] !== undefined)
      return scan(args[at + 1], "bash", context, depth + 1);
    for (const body of heredocs) {
      const result = scan(body, "bash", context, depth + 1);
      if (result.decision === "ask") return result;
    }
    if (fromPipe && !args.some((arg) => !arg.startsWith("-")))
      return ask("a shell reads commands from a pipe the text does not show");
    return allow();
  }
  if (POWERSHELLS.has(program)) {
    for (let k = 0; k < args.length; k++) {
      const arg = lowerArgs[k];
      if (/^-c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$/.test(arg))
        return scan(
          args.slice(k + 1).join(" "),
          "powershell",
          context,
          depth + 1,
        );
      if (arg.startsWith("-enc"))
        return scan(
          decodeEncoded(args[k + 1]),
          "powershell",
          context,
          depth + 1,
        );
      if (arg === "-file" || arg === "-f") return allow();
      if (
        [
          "-executionpolicy",
          "-ep",
          "-workingdirectory",
          "-wd",
          "-version",
          "-configurationname",
          "-inputformat",
          "-outputformat",
          "-windowstyle",
          "-w",
        ].includes(arg)
      ) {
        k++;
        continue;
      }
      if (arg.startsWith("-")) continue;
      return scan(args.slice(k).join(" "), "powershell", context, depth + 1);
    }
    return allow();
  }
  if (program === "cmd") {
    const at = lowerArgs.findIndex((arg) => ["/c", "/k", "/r"].includes(arg));
    if (at >= 0)
      return scan(
        args.slice(at + 1).join(" "),
        "powershell",
        context,
        depth + 1,
      );
    return allow();
  }
  if (program === "eval")
    return scan(args.join(" "), "bash", context, depth + 1);
  if (program === "iex" || program === "invoke-expression")
    return scan(args.join(" "), "powershell", context, depth + 1);
  if (program === "xargs" || program === "watch") {
    const rest = stripFlags(args, [
      "-I",
      "-n",
      "-P",
      "-d",
      "-L",
      "-s",
      "-E",
      "-a",
      "--interval",
    ]);
    return rest.length ? analyzeTokens(rest, context, depth + 1) : allow();
  }
  if (program === "find") {
    const at = args.findIndex((arg) =>
      ["-exec", "-execdir", "-ok", "-okdir"].includes(arg),
    );
    if (at < 0) return allow();
    let end = args.findIndex(
      (arg, k) => k > at && (arg === ";" || arg === "+"),
    );
    if (end < 0) end = args.length;
    return analyzeTokens(args.slice(at + 1, end), context, depth + 1);
  }
  if (program === "docker") {
    const at = args.findIndex((arg) => ["exec", "run"].includes(arg));
    if (at < 0) return allow();
    const inner = args.findIndex(
      (arg, k) =>
        k > at &&
        (programName(arg) === "supabase" || PG_TOOLS.has(programName(arg))),
    );
    return inner >= 0
      ? analyzeTokens(args.slice(inner), context, depth + 1)
      : allow();
  }
  if (["start-process", "saps", "start"].includes(program)) {
    // The file path is the first non-flag word; -ArgumentList text becomes its arguments.
    const words = [];
    for (let k = 0; k < args.length; k++) {
      const arg = args[k];
      if (arg.startsWith("-")) {
        if (["-filepath"].includes(arg.toLowerCase())) continue;
        if (
          [
            "-workingdirectory",
            "-verb",
            "-credential",
            "-windowstyle",
          ].includes(arg.toLowerCase())
        )
          k++;
        continue;
      }
      words.push(...arg.replace(/,/g, " ").split(/\s+/).filter(Boolean));
    }
    return words.length ? analyzeTokens(words, context, depth + 1) : allow();
  }
  return allow();
}

/** Parses command text and judges every command that runs in it. */
function scan(text, flavor, context, depth) {
  if (depth > MAX_DEPTH) return ask("command nesting too deep to inspect");
  const parsed = parse(text, flavor);
  if (parsed.error) {
    return MENTION.test(text)
      ? ask(
          `command text cannot be read reliably (${parsed.error}) and names a database tool`,
        )
      : allow();
  }
  for (const sub of parsed.subs) {
    const result = scan(sub, flavor, context, depth + 1);
    if (result.decision === "ask") return result;
  }
  for (const segment of parsed.segments) {
    const result = analyzeTokens(segment.tokens, context, depth, segment);
    if (result.decision === "ask") return result;
  }
  return allow();
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
    const command = /** @type {any} */ (tool_input)?.command;
    if (typeof command !== "string")
      throw new TypeError(`${tool_name} input has no command text`);
    return scan(
      command,
      tool_name === "PowerShell" ? "powershell" : "bash",
      { cwd, root },
      0,
    );
  }
  return allow("tool does not reach the hosted project");
}
