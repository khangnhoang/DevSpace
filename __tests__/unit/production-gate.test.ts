import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkOrder,
  createGit,
  decide,
  findWatchCommit,
  runGate,
  toPathspec,
  toPathspecs,
} from "../../scripts/ci/production-gate.mjs";

// Commit ids of a linear history c1 < c2 < ... < c6 on main, plus a commit that exists but sits on no line of it.
const sha = (n: number) => n.toString(16).padStart(40, "0");
const C = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((n) => [`c${n}`, sha(n)]),
) as Record<string, string>;
const ORPHAN = sha(0xa);
const MISSING = sha(0xb);

const chainGit = (known: string[] = Object.values(C)) => ({
  has: (s: string) => known.includes(s) || s === ORPHAN,
  isAncestor: (a: string, d: string) => {
    const order = Object.values(C);
    return (
      order.indexOf(a) !== -1 &&
      order.indexOf(d) !== -1 &&
      order.indexOf(a) <= order.indexOf(d)
    );
  },
});

describe("decide (AC1)", () => {
  const git = chainGit();

  it("passes when the reported commit is W", () => {
    expect(decide({ W: C.c3, C: C.c3, git })).toMatchObject({ pass: true });
  });

  it("passes when the reported commit is a descendant of W (a later backend merge superseded it)", () => {
    expect(decide({ W: C.c3, C: C.c5, git })).toMatchObject({ pass: true });
  });

  it("waits when the reported commit is an ancestor of W (an earlier backend build is still live)", () => {
    expect(decide({ W: C.c3, C: C.c2, git })).toMatchObject({
      pass: false,
      reason: "behind-or-unrelated",
    });
  });

  it("waits when the reported commit is in the history but neither ancestor nor descendant of W", () => {
    expect(decide({ W: C.c3, C: ORPHAN, git })).toMatchObject({
      pass: false,
      reason: "behind-or-unrelated",
    });
  });

  it("waits when the reported commit is not in the history", () => {
    expect(decide({ W: C.c3, C: MISSING, git })).toMatchObject({
      pass: false,
      reason: "unknown-commit",
    });
  });

  it.each([
    "unknown",
    "",
    "abc123",
    ORPHAN.toUpperCase(),
    `${C.c3}\n`,
    null,
    undefined,
    42,
    {},
  ])("waits for the malformed or missing commit %j", (value) => {
    expect(decide({ W: C.c3, C: value, git })).toMatchObject({
      pass: false,
      reason: "malformed",
    });
  });
});

describe("checkOrder (AC2 ordering)", () => {
  const run = (
    id: number,
    head: string,
    status: string,
    conclusion: string | null = null,
  ) => ({
    id,
    head_sha: head,
    status,
    conclusion,
  });
  const relation = (s: string) =>
    s === C.c1 || s === C.c2 ? "earlier" : s === C.c4 ? "later" : "other";

  it("is ok with no other run", () => {
    expect(checkOrder({ runs: [], ownRunId: 1, relation })).toEqual({
      kind: "ok",
    });
  });

  it("drops the run's own ID, so its own in-progress run does not block it", () => {
    expect(
      checkOrder({
        runs: [run(1, C.c3, "in_progress")],
        ownRunId: 1,
        relation: () => "earlier",
      }),
    ).toEqual({ kind: "ok" });
  });

  it.each(["queued", "in_progress", "waiting", "pending", "requested"])(
    "waits for an earlier run that is %s",
    (status) => {
      expect(
        checkOrder({ runs: [run(2, C.c2, status)], ownRunId: 1, relation }),
      ).toMatchObject({ kind: "wait", run: { id: 2 } });
    },
  );

  it("does not wait for an earlier run that ended, however it ended", () => {
    for (const conclusion of ["success", "failure", "cancelled", "timed_out"]) {
      expect(
        checkOrder({
          runs: [run(2, C.c2, "completed", conclusion)],
          ownRunId: 1,
          relation,
        }),
      ).toEqual({ kind: "ok" });
    }
  });

  it("is superseded when a later commit's run passed", () => {
    expect(
      checkOrder({
        runs: [run(3, C.c4, "completed", "success")],
        ownRunId: 1,
        relation,
      }),
    ).toEqual({ kind: "superseded", sha: C.c4 });
  });

  it("is not superseded by a later run that is still running or failed", () => {
    expect(
      checkOrder({
        runs: [run(3, C.c4, "in_progress")],
        ownRunId: 1,
        relation,
      }),
    ).toEqual({ kind: "ok" });
    expect(
      checkOrder({
        runs: [run(3, C.c4, "completed", "failure")],
        ownRunId: 1,
        relation,
      }),
    ).toEqual({ kind: "ok" });
  });

  it("ignores a run of a commit that is on neither side", () => {
    expect(
      checkOrder({
        runs: [run(5, C.c3, "in_progress")],
        ownRunId: 1,
        relation,
      }),
    ).toEqual({ kind: "ok" });
  });
});

// A scripted world for the loop: the clock only moves when the loop sleeps, and each poll takes the next scripted
// health answer (the last one repeats). `runs` is a function so a test can change the listing between polls.
type Answer = { status: number; body: unknown; server?: string } | Error;
function harness(options: {
  W?: string;
  answers: Answer[];
  runs?: (poll: number) => unknown[] | Error;
  earlier?: string[];
  later?: string[];
  known?: string[];
  deadlineMs?: number;
}) {
  let time = 0;
  let healthCalls = 0;
  let runsCalls = 0;
  let fetchMainCalls = 0;
  const sleeps: number[] = [];
  const known = options.known ?? Object.values(C);
  const base = chainGit(known);
  const result = runGate({
    M: C.c5,
    W: options.W ?? C.c3,
    ownRunId: 100,
    healthUrl: "https://health.test/api/health",
    deadlineMs: options.deadlineMs ?? 60_000,
    pollMs: 15_000,
    deps: {
      now: () => time,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        time += ms;
      },
      fetchHealth: async () => {
        const answer =
          options.answers[Math.min(healthCalls++, options.answers.length - 1)];
        if (answer instanceof Error) throw answer;
        return answer;
      },
      listRuns: async () => {
        const runs = (options.runs ?? (() => []))(runsCalls++);
        if (runs instanceof Error) throw runs;
        return runs as never;
      },
      git: {
        ...base,
        fetchMain: () => {
          fetchMainCalls++;
        },
        orderSets: () => ({
          earlier: new Set(options.earlier ?? []),
          later: new Set(options.later ?? []),
        }),
      },
    },
  });
  return {
    result,
    counts: () => ({ healthCalls, runsCalls, fetchMainCalls, sleeps }),
  };
}
const healthy = (commit: unknown): Answer => ({
  status: 200,
  body: { ok: true, commit },
});
const run = (
  id: number,
  head_sha: string,
  status: string,
  conclusion: string | null = null,
) => ({ id, head_sha, status, conclusion });

describe("runGate (AC2)", () => {
  it("passes on the first poll that satisfies the rule, without sleeping", async () => {
    const h = harness({ answers: [healthy(C.c3)] });
    const result = await h.result;
    expect(result.pass).toBe(true);
    expect(h.counts().healthCalls).toBe(1);
    expect(h.counts().sleeps).toEqual([]);
  });

  it("keeps polling while the API reports an older commit, then passes when it catches up", async () => {
    const h = harness({
      answers: [healthy(C.c2), healthy(C.c2), healthy(C.c3)],
    });
    expect((await h.result).pass).toBe(true);
    expect(h.counts().healthCalls).toBe(3);
    expect(h.counts().sleeps).toEqual([15_000, 15_000]);
  });

  it("retries a network error and passes afterwards", async () => {
    const h = harness({ answers: [new Error("ECONNRESET"), healthy(C.c3)] });
    expect((await h.result).pass).toBe(true);
    expect(h.counts().healthCalls).toBe(2);
  });

  it.each([
    ["a 502 answer", { status: 502, body: { ok: true, commit: C.c3 } }],
    ["a 404 answer", { status: 404, body: null }],
    ["a body without ok: true", { status: 200, body: { commit: C.c3 } }],
    ["ok: false", { status: 200, body: { ok: false, commit: C.c3 } }],
    ["a body that is not JSON", { status: 200, body: null }],
  ] as const)("retries %s and never reads it as a pass", async (_name, bad) => {
    const h = harness({ answers: [bad as Answer, healthy(C.c3)] });
    expect((await h.result).pass).toBe(true);
    expect(h.counts().healthCalls).toBe(2);
  });

  it("fails at the deadline and prints M, W, the last reported commit and the last answer's status", async () => {
    const h = harness({
      answers: [
        {
          status: 200,
          body: { ok: true, commit: C.c2 },
          server: "railway-edge",
        },
      ],
      deadlineMs: 45_000,
    });
    const result = await h.result;
    expect(result.pass).toBe(false);
    expect(result.message).toContain(`M=${C.c5}`);
    expect(result.message).toContain(`W=${C.c3}`);
    expect(result.message).toContain(`last reported commit=${C.c2}`);
    expect(result.message).toContain("HTTP 200");
    expect(result.message).toContain("railway-edge");
  });

  it("fails at the deadline when every answer is an error, never passing on timeout", async () => {
    const h = harness({
      answers: [new Error("ENOTFOUND")],
      deadlineMs: 30_000,
    });
    const result = await h.result;
    expect(result.pass).toBe(false);
    expect(result.message).toContain("error: ENOTFOUND");
  });

  it("fails at the deadline for an unknown commit that stays unknown", async () => {
    const h = harness({ answers: [healthy("unknown")], deadlineMs: 30_000 });
    expect((await h.result).pass).toBe(false);
  });

  it("re-fetches main once before treating an unknown commit as missing, then waits", async () => {
    const h = harness({
      answers: [healthy(MISSING)],
      known: Object.values(C),
      deadlineMs: 60_000,
    });
    expect((await h.result).pass).toBe(false);
    expect(h.counts().fetchMainCalls).toBe(1);
  });

  it("passes when the re-fetch makes the reported commit known", async () => {
    // The fake history learns the commit only after fetchMain ran.
    let time = 0;
    let fetched = false;
    const newer = sha(7);
    const result = await runGate({
      M: C.c5,
      W: C.c3,
      ownRunId: 100,
      deadlineMs: 60_000,
      pollMs: 15_000,
      deps: {
        now: () => time,
        sleep: async (ms: number) => {
          time += ms;
        },
        fetchHealth: async () => healthy(newer) as never,
        listRuns: async () => [],
        git: {
          has: (s: string) =>
            s === newer ? fetched : Object.values(C).includes(s),
          isAncestor: () => true,
          fetchMain: () => {
            fetched = true;
          },
          orderSets: () => ({
            earlier: new Set<string>(),
            later: new Set<string>(),
          }),
        },
      },
    });
    expect(result.pass).toBe(true);
  });

  it("treats a failing git read as a wait, never a pass", async () => {
    let time = 0;
    const result = await runGate({
      M: C.c5,
      W: C.c3,
      ownRunId: 100,
      deadlineMs: 30_000,
      pollMs: 15_000,
      deps: {
        now: () => time,
        sleep: async (ms: number) => {
          time += ms;
        },
        fetchHealth: async () => healthy(C.c4) as never,
        listRuns: async () => [],
        git: {
          has: () => true,
          isAncestor: () => {
            throw new Error("git exploded");
          },
          fetchMain: () => {},
          orderSets: () => ({
            earlier: new Set<string>(),
            later: new Set<string>(),
          }),
        },
      },
    });
    expect(result.pass).toBe(false);
  });

  describe("ordering", () => {
    it("a later merge sharing W waits until the earlier run ends", async () => {
      // Run 7 is the earlier merge's run; it ends on the third listing.
      const h = harness({
        answers: [healthy(C.c3)],
        earlier: [C.c4],
        runs: (poll) => [
          run(
            7,
            C.c4,
            poll < 2 ? "in_progress" : "completed",
            poll < 2 ? null : "success",
          ),
        ],
      });
      expect((await h.result).pass).toBe(true);
      expect(h.counts().runsCalls).toBe(3);
    });

    it("a re-run of an older commit after a later pass fails as superseded", async () => {
      const h = harness({
        answers: [healthy(C.c5)],
        later: [C.c6],
        runs: () => [run(9, C.c6, "completed", "success")],
      });
      const result = await h.result;
      expect(result.pass).toBe(false);
      expect(result.message).toContain(`superseded by ${C.c6}`);
      expect(h.counts().healthCalls).toBe(1);
    });

    it("a later run that passes between two polls makes the earlier run fail as superseded", async () => {
      const h = harness({
        answers: [healthy(C.c3)],
        earlier: [C.c4],
        later: [C.c6],
        runs: (poll) =>
          poll === 0
            ? [run(7, C.c4, "in_progress")]
            : [
                run(7, C.c4, "completed", "failure"),
                run(9, C.c6, "completed", "success"),
              ],
      });
      const result = await h.result;
      expect(result.pass).toBe(false);
      expect(result.message).toContain("superseded");
    });

    it("an earlier run still queued at the deadline fails the run and names it", async () => {
      const h = harness({
        answers: [healthy(C.c3)],
        earlier: [C.c4],
        runs: () => [run(7, C.c4, "queued")],
        deadlineMs: 30_000,
      });
      const result = await h.result;
      expect(result.pass).toBe(false);
      expect(result.message).toContain("earlier run 7");
      expect(result.message).toContain(C.c4);
    });

    it.each([["an error", new Error("boom")]])(
      "retries %s of the runs listing and never reads it as no earlier run in progress",
      async (_name, failure) => {
        const h = harness({
          answers: [healthy(C.c3)],
          earlier: [C.c4],
          runs: (poll) =>
            poll === 0
              ? (failure as Error)
              : [run(7, C.c4, "completed", "success")],
        });
        expect((await h.result).pass).toBe(true);
        expect(h.counts().runsCalls).toBe(2);
      },
    );

    it("a listing that keeps failing fails at the deadline instead of passing", async () => {
      const h = harness({
        answers: [healthy(C.c3)],
        runs: () => new Error("the runs API answered 403"),
        deadlineMs: 30_000,
      });
      const result = await h.result;
      expect(result.pass).toBe(false);
    });

    it("excludes the run's own ID from the listing", async () => {
      const h = harness({
        answers: [healthy(C.c3)],
        earlier: [C.c5],
        runs: () => [run(100, C.c5, "in_progress")],
      });
      expect((await h.result).pass).toBe(true);
    });
  });
});

describe("watch paths (AC3)", () => {
  const file = fileURLToPath(
    new URL("../../scripts/ci/railway-watch-paths.json", import.meta.url),
  );
  const patterns: string[] = JSON.parse(readFileSync(file, "utf8"));

  it("holds exactly the eight patterns the Railway dashboard shows", () => {
    expect(patterns).toEqual([
      "/backend/**",
      "/lib/schemas/**",
      "/scripts/api/**",
      "/package.json",
      "/package-lock.json",
      "/.node-version",
      "/Dockerfile.api",
      "/.dockerignore",
    ]);
  });

  it("turns a dashboard pattern into a root-relative glob pathspec", () => {
    expect(toPathspec("/backend/**")).toBe(":(glob)backend/**");
    expect(toPathspec("/package.json")).toBe(":(glob)package.json");
    expect(toPathspecs(patterns)).toHaveLength(8);
  });

  it.each([[""], ["backend/**"], ["/"], [undefined], [3]])(
    "refuses the invalid pattern %j",
    (value) => {
      expect(() => toPathspec(value as never)).toThrow();
    },
  );

  it("refuses an empty or non-array list", () => {
    expect(() => toPathspecs([])).toThrow();
    expect(() => toPathspecs("/backend/**")).toThrow();
  });
});

// Real git, in a throwaway repository: the pathspec conversion and the ancestry calls are only trusted when git
// itself answers them.
describe("findWatchCommit and createGit on a real repository (AC1, AC3)", () => {
  const root = mkdtempSync(join(tmpdir(), "production-gate-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.test",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
  const commitFile = (path: string, message: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `${message}\n`);
    git("add", "--", path);
    git("commit", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const patterns = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../../scripts/ci/railway-watch-paths.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as string[];
  const specs = toPathspecs(patterns);
  const W = (m: string) => findWatchCommit(m, specs, root);

  git("init", "-b", "main");
  const base = commitFile("backend/base.ts", "base");

  it.each([
    ["backend/src/x.ts", true],
    ["backend/deep/er/y.ts", true],
    ["lib/schemas/a.ts", true],
    ["scripts/api/build.mjs", true],
    ["package.json", true],
    ["package-lock.json", true],
    [".node-version", true],
    ["Dockerfile.api", true],
    [".dockerignore", true],
    ["backend-foo/x", false],
    ["docs/package.json", false],
    ["lib/schemas-old/x", false],
    ["lib/schemas.ts", false],
    ["app/page.tsx", false],
    ["scripts/ci/production-gate.mjs", false],
    ["Dockerfile", false],
  ])(
    "treats a commit touching %s as watch-path commit: %s",
    (path, matches) => {
      const before = W(git("rev-parse", "HEAD"));
      const commit = commitFile(path, `touch ${path}`);
      expect(W(commit)).toBe(matches ? commit : before);
    },
  );

  it("counts a merge commit as itself, the commit Railway deploys, not the branch commits inside it", () => {
    git("checkout", "-b", "feature");
    const inside = commitFile("backend/feature.ts", "feature backend change");
    git("checkout", "main");
    commitFile("docs/note.txt", "docs on main meanwhile");
    git("merge", "--no-ff", "feature", "-m", "Merge feature");
    const merge = git("rev-parse", "HEAD");
    expect(W(merge)).toBe(merge);
    expect(W(merge)).not.toBe(inside);
    const after = commitFile("docs/after.txt", "docs after the merge");
    expect(W(after)).toBe(merge);
  });

  it("returns null when no commit at or before M touches a watch path", () => {
    const rootCommit = (() => {
      git("checkout", "--orphan", "bare");
      git("rm", "-rf", "--quiet", ".");
      return commitFile("docs/only.txt", "docs only");
    })();
    expect(W(rootCommit)).toBeNull();
    git("checkout", "main");
  });

  it("answers ancestry and presence with git", () => {
    const head = git("rev-parse", "HEAD");
    const real = createGit(head, root);
    expect(real.has(base)).toBe(true);
    expect(real.has(MISSING)).toBe(false);
    expect(real.isAncestor(base, head)).toBe(true);
    expect(real.isAncestor(head, base)).toBe(false);
    expect(real.isAncestor(head, head)).toBe(true);
  });

  it("does not treat a commit of an unrelated line as a descendant of W", () => {
    const head = git("rev-parse", "HEAD");
    const orphanTip = git("rev-parse", "bare");
    const real = createGit(head, root);
    expect(real.has(orphanTip)).toBe(true);
    expect(decide({ W: head, C: orphanTip, git: real })).toMatchObject({
      pass: false,
      reason: "behind-or-unrelated",
    });
  });
});
