// TM-U1 AC8, G6: an error raised while the check reads the backup is reported as a step and an error code, never
// with a path below the backup folder, an object name or a piece of file content.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ReadFailure,
  compareStorageFiles,
  describeFailure,
  parseStorageRows,
  scanBackupFile,
} from "../../scripts/backup/check.mjs";

const MARKER = "SECRET-MARKER-4711";
let folder: string;
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "backup-errors-"));
});
afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("backup:check reduces every error raised while reading the backup (AC8, G6)", () => {
  // A backup file name or content that reaches stdout or a saved file is a leak.
  const reduced = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      return error as Error;
    }
    throw new Error("expected the step to fail");
  };

  it("reports an unreadable object as a step and a code, without its path", async () => {
    mkdirSync(join(folder, "storage", "avatars"), { recursive: true });
    writeFileSync(join(folder, "storage", "avatars", `${MARKER}.png`), "x");
    const rows = [
      {
        bucket: "avatars",
        name: `${MARKER}.png`,
        size: 1,
        etag: "9dd4e461268c8034f5c8564e155c67a6",
      },
    ];
    const error = await reduced(() =>
      compareStorageFiles(folder, rows, (file: string) => {
        throw Object.assign(
          new Error(`EACCES: permission denied, open '${file}'`),
          {
            code: "EACCES",
          },
        );
      }),
    );
    expect(error).toBeInstanceOf(ReadFailure);
    expect(error.message).toBe(
      "step compare storage files failed (error code EACCES)",
    );
    expect(describeFailure(error)).not.toContain(MARKER);
  });

  it("reports unparsable JSON as a step and a code, without a piece of the content", async () => {
    const text = `[{"n":"${MARKER}","b":`;
    expect(() => JSON.parse(text)).toThrow(); // the raw message is what the reduction replaces
    const error = await reduced(() => parseStorageRows(text));
    expect(error.message).toBe(
      "step read storage rows failed (error code PARSE)",
    );
    expect(describeFailure(error)).not.toContain(MARKER);
  });

  it("reports a truncated SQL file and a file it cannot open as a step and a code", async () => {
    writeFileSync(
      join(folder, "data.sql"),
      `COPY public."${MARKER}" (id) FROM stdin;\n1\n`,
    );
    const truncated = await reduced(() =>
      scanBackupFile(folder, "data.sql", "scan data file"),
    );
    expect(truncated.message).toBe(
      "step scan data file failed (error code UNKNOWN)",
    );
    const missing = await reduced(() =>
      scanBackupFile(join(folder, MARKER), "history.sql", "scan history file"),
    );
    expect(missing.message).toBe(
      "step scan history file failed (error code ENOENT)",
    );
    for (const error of [truncated, missing])
      expect(describeFailure(error)).not.toContain(MARKER);
  });

  it("prints an error of any other kind as a step and a code, never its message", () => {
    const raw = Object.assign(new Error(`open '${MARKER}'`), { code: "EIO" });
    expect(describeFailure(raw)).toBe(
      "FAIL: step unexpected error failed (error code EIO)",
    );
    expect(describeFailure(new SyntaxError(`token ${MARKER}`))).not.toContain(
      MARKER,
    );
    expect(describeFailure(new Error(MARKER))).toContain("UNKNOWN");
  });
});
