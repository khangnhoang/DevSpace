import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { superviseAll } from "../../scripts/dev/supervise.mjs";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(check: () => boolean, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return check();
}

// A stand-in for a server: writes its pid, then stays alive until it is stopped.
function longRunning(pidFile: string) {
  return {
    name: "stays",
    command: process.execPath,
    args: [
      "-e",
      `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`,
    ],
  };
}

describe("superviseAll (npm run dev)", () => {
  it("stops the other server and fails when one server exits, so the launcher never keeps half the stack alive", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dev-supervise-"));
    dirs.push(dir);
    const pidFile = join(dir, "pid");
    const logs: string[] = [];
    const result = superviseAll(
      [
        longRunning(pidFile),
        // Exits only after the first one has written its pid, so the assertion below always has a process to check.
        {
          name: "dies",
          command: process.execPath,
          args: [
            "-e",
            `const fs=require("fs");const t=setInterval(()=>{if(fs.existsSync(${JSON.stringify(pidFile)})){clearInterval(t);process.exit(3);}},20);`,
          ],
        },
      ],
      { log: (line) => logs.push(line) },
    );
    expect(await result).toBe(3);
    const pid = Number(readFileSync(pidFile, "utf8"));
    expect(
      await waitFor(() => !alive(pid)),
      "the surviving server was not stopped",
    ).toBe(true);
    expect(logs.join("\n")).toContain("dies");
  });

  it("fails and stops the other server when one cannot start", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dev-supervise-"));
    dirs.push(dir);
    const pidFile = join(dir, "pid");
    const code = await superviseAll(
      [
        longRunning(pidFile),
        { name: "missing", command: join(dir, "no-such-program"), args: [] },
      ],
      { log: () => {} },
    );
    expect(code).not.toBe(0);
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, "utf8"));
      expect(await waitFor(() => !alive(pid))).toBe(true);
    }
  });

  it("treats a clean exit of one server as a failure too", async () => {
    const code = await superviseAll(
      [
        {
          name: "quits",
          command: process.execPath,
          args: ["-e", "process.exit(0)"],
        },
        {
          name: "also",
          command: process.execPath,
          args: ["-e", "setInterval(() => {}, 1000)"],
        },
      ],
      { log: () => {} },
    );
    expect(code).not.toBe(0);
  });
});
