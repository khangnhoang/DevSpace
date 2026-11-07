// TM-U1 AC1-AC5: the hook asks before anything that can reach the hosted project and never before local work.
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classify } from "../../scripts/agent-guard/db-command.mjs";

const ROOT = "C:\\DevSpace";
const CWD = "C:\\DevSpace";

const bash = (command: string, cwd = CWD) =>
  classify({ tool_name: "Bash", tool_input: { command }, cwd, root: ROOT });
const powershell = (command: string, cwd = CWD) =>
  classify({
    tool_name: "PowerShell",
    tool_input: { command },
    cwd,
    root: ROOT,
  });

const ASKS = [
  // AC1: every always-ask form, with and without --local
  "npx supabase db push",
  "npx supabase db push --local",
  "npx supabase db push --dry-run",
  "npx supabase db pull",
  "npx supabase db pull --local",
  "npx supabase migration repair --status applied 20261021000000",
  "npx supabase migration repair --local --status applied 1",
  "npx supabase migrations repair 1",
  "npx supabase link --project-ref abc",
  "npx supabase unlink",
  "npx supabase pull",
  "npx supabase migration list --linked",
  "npx supabase migration list --linked --local",
  "npx supabase db dump --linked -f x.sql",
  "npx supabase db dump --db-url postgresql://u@h/db",
  "npx supabase db dump --db-url=postgresql://u@h/db",
  "npx supabase --project-ref abc projects list",
  "npx supabase storage cp -r --linked ss:///avatars out",
  // G2 (4): not provably local
  "npx supabase migration list",
  "npx supabase db dump -f x.sql",
  "npx supabase storage ls",
  "npx supabase functions deploy x",
  "npx supabase projects list",
  "npx supabase",
  // G3: compound lines and wrappers
  "cd x && npx.cmd supabase db push",
  "echo hi; npx supabase db push",
  "npx supabase status || npx supabase db push",
  "npx supabase status | npx supabase db push",
  "npx supabase status\nnpx supabase db push",
  "fnm exec -- npx.cmd supabase db push",
  "./node_modules/.bin/supabase db push",
  "C:\\x\\node_modules\\.bin\\supabase.cmd db push",
  '"C:\\x\\supabase.exe" db push',
  "NPX SUPABASE DB PUSH",
  "npx supabase@2.121.0 db push",
  "npx -y supabase db push",
  "env FOO=bar supabase db push",
  "(npx supabase db push)",
  "echo $(npx supabase db push)",
  'echo "$(npx supabase db push)"',
  'bash -c "npx supabase db push"',
  "sh -c 'cd x && supabase db push'",
  "sh -lc 'cd x && npx.cmd supabase link'",
  'powershell -Command "npx supabase db pull"',
  'pwsh -c "npx supabase db push"',
  'cmd /c "npx supabase migration repair"',
  'eval "npx supabase db push"',
  "xargs npx supabase db push",
  "find . -exec psql {} +",
  "FOO=1 npx -y supabase@2 db push",
  "env -i FOO=1 supabase db push",
  "time npx supabase db push",
  "nohup npx supabase db push",
  "fnm exec --using=26 -- npx.cmd supabase --linked migration list",
  'npx supabase db push "--linked"',
  'npx supabase "db" push',
  "npx supabase 'db' 'push'",
  'echo "supabase db push',
  "npm exec -- supabase db push",
  "supabase db push `\n--linked",
  // PowerShell spelling
  "& npx.cmd supabase db push",
  '& "C:\\x\\supabase.exe" db push',
  "Set-Location x; npx.cmd supabase db push",
  'Start-Process supabase -ArgumentList "db push"',
  'powershell -Command "npx supabase db push"',
  "iex 'npx supabase db push'",
  "Invoke-Expression 'npx supabase link'",
  'Write-Output "$(npx supabase db push)"',
  // AC2: db reset outside the test workdir
  "npx supabase db reset",
  "npx supabase db reset --local",
  "npx supabase db reset --workdir C:\\other\\.supabase-test",
  "npx supabase db reset --workdir C:\\DevSpace\\.supabase-test\\..",
  "npx supabase db reset --workdir $WD",
  "npx supabase db reset --workdir C:\\DevSpace\\.supabase-test --workdir C:\\x",
  "npx supabase db reset --workdir",
  "npx supabase db reset --workdir C:\\DevSpace\\.supabase-test --linked",
  // AC2: libpq tools
  "psql -h 127.0.0.1 -U postgres",
  "psql",
  "pg_dump mydb",
  "pg_restore -d x f.dump",
  "PGHOSTADDR=1.2.3.4 psql",
  '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -c "select 1"',
  "docker exec supabase_db_x psql -U postgres",
  "psql --help-me",
];

const ALLOWS = [
  // AC4
  "npx supabase start",
  "npx supabase stop",
  "npx supabase status",
  "npx supabase status -o json",
  "npx supabase init",
  "npx supabase migration list --local",
  "npx supabase migration up --local",
  "npx supabase migration new add_x",
  "npx supabase migrations new add_x",
  "npx supabase db dump --local -f out.sql",
  "npx supabase db dump --local --data-only --use-copy -f out.sql",
  "npx supabase db reset --local --workdir C:\\DevSpace\\.supabase-test",
  "npx supabase --workdir .supabase-test db reset",
  "npx supabase --workdir /c/DevSpace/.supabase-test db reset",
  "npx supabase db reset --workdir=C:\\DevSpace\\.SUPABASE-TEST",
  "npx supabase --help",
  "npx supabase -h",
  "npx supabase db push --help",
  "npx supabase --version",
  "npx supabase -v",
  "fnm exec -- npx.cmd supabase status",
  "cd C:\\DevSpace && npx supabase migration list --local",
  "psql --help",
  "psql --version",
  "pg_dump --version",
  "npm test",
  "npm run test:e2e",
  "npm run backup:check -- C:\\Users\\x\\devspace-backups\\20261108-1200",
  "npm run lint",
  "npx tsc --noEmit",
  "git status",
  'git commit -m "chore: guard supabase db push and psql calls"',
  "git add supabase/migrations/x.sql",
  "cd supabase",
  "ls supabase",
  "rg link supabase",
  "Get-ChildItem supabase",
  "Select-String -Path supabase\\config.toml -Pattern link",
  "node scripts/test-stack/test.mjs",
  "echo ok",
  "docker ps -a",
  // Text that only mentions a database command is data, not a command that runs.
  "echo npx supabase db push",
  'git commit -m "fix supabase db push --linked handling"',
  'grep -rn "psql" scripts',
  "sed -i 's/--linked/x/' f",
  "node -e \"console.log('npx supabase db push')\"",
  `printf '{"tool_input":{"command":"npx supabase db push"}}' | node .claude/hooks/db-command-guard.mjs`,
  'rg "supabase db push" docs',
  "Write-Output 'supabase db push --linked'",
  "Select-String -Pattern 'psql' -Path x.md",
  "npm run docs:check",
  "bash scripts/x.sh",
  "git log --grep='supabase db push'",
];

// Spellings that only one shell reads as a command: the same text means something else in the other one.
const ASKS_BASH = [
  "echo `npx supabase db push`",
  "echo `psql -c 1`",
  'echo \\" ; supabase db push ; echo \\"',
  "bash <<EOF\nnpx supabase db push\nEOF",
  "bash <<-EOF\n\tnpx supabase db push\n\tEOF",
  "sh <<'EOF'\nsupabase link\nEOF",
  "cat <<EOF | bash\nnpx supabase db push\nEOF",
  "cat <<EOF | sh\nnpx supabase db push\nEOF",
  "echo 'npx supabase db push' | bash",
  "psql <<EOF\nselect 1\nEOF",
  "bash -c 'cat <<EOF\nx\nEOF\nnpx supabase db push'",
];
const ALLOWS_BASH = [
  "cat > f <<'EOF'\nnpx supabase db push --linked\nEOF",
  "cat > f <<EOF\nnpx supabase db push --linked\nEOF",
  "cat <<-EOF > f\n\tnpx supabase db push\n\tEOF",
  "python - <<'PY'\nprint('supabase db push --linked')\nPY",
  "git commit -F - <<'MSG'\nfix: supabase db push --linked\nMSG",
  "echo 'a `supabase db push` b'",
  'echo "\\$(npx supabase db push)"',
  "echo '$(npx supabase db push)'",
];
const ASKS_POWERSHELL = [
  'iex "$(npx supabase db push)"',
  "$x = $(npx supabase db push)",
  '$q = @"\n$(npx supabase db push)\n"@',
];
const ALLOWS_POWERSHELL = [
  "$q = @'\nsupabase db push --linked\n'@",
  '$q = @"\nnpx supabase db push\n"@',
  "$q = @'\nsupabase db push\n'@\nWrite-Output $q",
  'Write-Output `"npx supabase db push`"',
  "echo '$(npx supabase db push)'",
];

describe("agent guard: db command classifier", () => {
  it.each(ASKS)("asks before %j", (command) => {
    const bashResult = bash(command);
    expect(bashResult.decision, bashResult.reason).toBe("ask");
    // PowerShell input goes through the same rules.
    expect(powershell(command).decision).toBe("ask");
  });

  it.each(ALLOWS)("lets %j run", (command) => {
    const result = bash(command);
    expect(result.decision, result.reason).toBe("allow");
    expect(powershell(command).decision).toBe("allow");
  });

  it.each(ASKS_BASH)("asks before %j in Bash", (command) => {
    const result = bash(command);
    expect(result.decision, result.reason).toBe("ask");
  });
  it.each(ALLOWS_BASH)("lets %j run in Bash", (command) => {
    const result = bash(command);
    expect(result.decision, result.reason).toBe("allow");
  });
  it.each(ASKS_POWERSHELL)("asks before %j in PowerShell", (command) => {
    const result = powershell(command);
    expect(result.decision, result.reason).toBe("ask");
  });
  it.each(ALLOWS_POWERSHELL)("lets %j run in PowerShell", (command) => {
    const result = powershell(command);
    expect(result.decision, result.reason).toBe("allow");
  });

  it("asks when the text cannot be read and names a database tool, and only then", () => {
    for (const command of [
      'echo "supabase db push',
      "echo $(supabase db push",
      "cat <<EOF\nsupabase db push\n",
      "echo 'psql",
    ]) {
      const result = bash(command);
      expect(result.decision, command).toBe("ask");
      expect(result.reason).toMatch(/cannot be read/);
    }
    expect(bash('echo "unfinished').decision).toBe("allow");
    expect(bash("echo $(ls").decision).toBe("allow");
  });

  it("stops at the nesting limit instead of recursing forever", () => {
    let command = "npx supabase status";
    for (let i = 0; i < 8; i++)
      command = `bash -c '${command.replaceAll("'", `'\\''`)}'`;
    expect(bash(command).decision).toBe("ask");
  });

  it("resolves a relative --workdir against the call's working directory", () => {
    const reset = "npx supabase --workdir .supabase-test db reset";
    expect(bash(reset, "C:\\DevSpace").decision).toBe("allow");
    expect(bash(reset, "C:\\DevSpace\\app").decision).toBe("ask");
    expect(
      bash(
        "npx supabase --workdir ..\\.supabase-test db reset",
        "C:\\DevSpace\\app",
      ).decision,
    ).toBe("allow");
    expect(bash(reset, "").decision).toBe("ask");
    expect(
      classify({
        tool_name: "Bash",
        tool_input: { command: reset },
        root: ROOT,
      }).decision,
    ).toBe("ask");
  });

  it("asks for db reset when the checkout root is unknown", () => {
    expect(
      classify({
        tool_name: "Bash",
        tool_input: {
          command:
            "npx supabase --workdir C:\\DevSpace\\.supabase-test db reset",
        },
        cwd: CWD,
      }).decision,
    ).toBe("ask");
  });

  it("applies the same rule on a POSIX checkout", () => {
    const run = (command: string) =>
      classify({
        tool_name: "Bash",
        tool_input: { command },
        cwd: "/repo",
        root: "/repo",
      }).decision;
    expect(run("supabase --workdir .supabase-test db reset")).toBe("allow");
    expect(run("supabase --workdir /repo/.supabase-test db reset")).toBe(
      "allow",
    );
    expect(run("supabase --workdir /repo/.Supabase-Test db reset")).toBe("ask");
    expect(run("supabase --workdir /other/.supabase-test db reset")).toBe(
      "ask",
    );
  });

  it("names the matched rule in the reason", () => {
    expect(bash("npx supabase db push").reason).toMatch(/db push/);
    expect(bash("npx supabase migration list --linked").reason).toMatch(
      /--linked/,
    );
    expect(bash("psql -h 127.0.0.1").reason).toMatch(/psql/);
  });

  // AC3
  const WRITE_TOOLS = [
    "apply_migration",
    "execute_sql",
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
  const READ_TOOLS = [
    "list_tables",
    "list_migrations",
    "list_extensions",
    "list_branches",
    "get_advisors",
    "get_logs",
    "get_project",
    "get_project_url",
    "search_docs",
    "generate_typescript_types",
  ];

  it.each(WRITE_TOOLS)("asks before the Supabase MCP tool %s", (tool) => {
    for (const server of [
      "supabase",
      "9e36dc71-5403-4f99-b02c-33135ca65ba0",
      "claude_ai_Supabase",
    ]) {
      const result = classify({
        tool_name: `mcp__${server}__${tool}`,
        tool_input: {},
        cwd: CWD,
        root: ROOT,
      });
      expect(result.decision).toBe("ask");
      expect(result.reason).toContain(tool);
    }
  });

  it.each(READ_TOOLS)("lets the read-only Supabase MCP tool %s run", (tool) => {
    expect(
      classify({
        tool_name: `mcp__supabase__${tool}`,
        tool_input: {},
        cwd: CWD,
        root: ROOT,
      }).decision,
    ).toBe("allow");
  });

  it("does not stop other tools", () => {
    for (const tool_name of [
      "Read",
      "Edit",
      "Write",
      "Grep",
      "mcp__x__execute_sql_not",
    ]) {
      expect(
        classify({
          tool_name,
          tool_input: { file_path: "x" },
          cwd: CWD,
          root: ROOT,
        }).decision,
      ).toBe("allow");
    }
  });

  it("throws on a payload it cannot read", () => {
    expect(() => classify({ tool_input: { command: "ls" } })).toThrow();
    expect(() => classify({ tool_name: 1 as unknown as string })).toThrow();
    expect(() => classify({ tool_name: "Bash" })).toThrow();
    expect(() => classify({ tool_name: "Bash", tool_input: null })).toThrow();
    expect(() =>
      classify({ tool_name: "Bash", tool_input: { command: 3 } }),
    ).toThrow();
    expect(() =>
      classify({ tool_name: "PowerShell", tool_input: {} }),
    ).toThrow();
  });
});

// The hook script around the classifier (AC5): malformed input and every fault-switch value fail closed.
describe("agent guard: hook script", () => {
  const run = (input: string, fault?: string, timeout = 20_000) => {
    // A copy of the hook next to a copy of the module keeps the real fault file out of the test.
    const dir = mkdtempSync(join(tmpdir(), "guard-"));
    try {
      mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
      mkdirSync(join(dir, "scripts", "agent-guard"), { recursive: true });
      copyFileSync(
        join(process.cwd(), ".claude/hooks/db-command-guard.mjs"),
        join(dir, ".claude/hooks/db-command-guard.mjs"),
      );
      copyFileSync(
        join(process.cwd(), "scripts/agent-guard/db-command.mjs"),
        join(dir, "scripts/agent-guard/db-command.mjs"),
      );
      if (fault !== undefined)
        writeFileSync(join(dir, ".claude/hooks/.fault"), fault);
      return spawnSync(
        process.execPath,
        [join(dir, ".claude/hooks/db-command-guard.mjs")],
        {
          input,
          encoding: "utf8",
          timeout,
        },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const payload = (command: string, tool_name = "Bash") =>
    JSON.stringify({ tool_name, tool_input: { command }, cwd: process.cwd() });

  it("prints an ask decision with the reason for a hosted command", () => {
    const result = run(payload("npx supabase db push"));
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(output.hookSpecificOutput.permissionDecision).toBe("ask");
    expect(output.hookSpecificOutput.permissionDecisionReason).toMatch(
      /db push/,
    );
  });

  it("prints nothing for a local command", () => {
    const result = run(payload("npx supabase status"));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("asks for a Supabase MCP write", () => {
    const result = run(
      JSON.stringify({
        tool_name: "mcp__supabase__execute_sql",
        tool_input: { query: "select 1" },
      }),
    );
    expect(
      JSON.parse(result.stdout).hookSpecificOutput.permissionDecision,
    ).toBe("ask");
  });

  it.each([
    ["empty stdin", ""],
    ["not JSON", "not json"],
    ["a JSON array", "[]"],
    ["a JSON string", '"x"'],
    ["null", "null"],
    ["no tool name", JSON.stringify({ tool_input: { command: "ls" } })],
    ["no command", JSON.stringify({ tool_name: "Bash", tool_input: {} })],
  ])("blocks (exit 2) on malformed input: %s", (_name, input) => {
    const result = run(input);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });

  it("blocks on the crash switch and on any other switch value", () => {
    for (const fault of ["crash", "anything", "allow", "off", "ALLOW"]) {
      const result = run(payload("echo ok"), fault);
      expect(result.status, fault).toBe(2);
      expect(result.stdout, fault).toBe("");
    }
  });

  it("prints invalid JSON on the invalid switch", () => {
    const result = run(payload("echo ok"), "invalid");
    expect(() => JSON.parse(result.stdout)).toThrow();
    expect(result.stdout.startsWith("{")).toBe(true);
  });

  it("does not answer within the timeout on the sleep switch", () => {
    const result = run(payload("echo ok"), "sleep", 1500);
    expect(result.stdout).toBe("");
    expect(result.status).not.toBe(0);
  });

  it("runs normally when the switch file is empty", () => {
    const result = run(payload("echo ok"), "");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});
