#!/usr/bin/env node
// The production gate (techstack-migration TM-U16): the `production-gate` check of a push to `main`. Vercel holds
// the production domain assignment for the merge's deployment until this check passes (an Owner setting), and the
// check passes only once the Railway API reports a backend commit that contains the merge's backend change.
//
// Terms (plan section 1.1): M is the merged commit (GITHUB_SHA). W is the latest commit on main's first-parent line
// at or before M whose own change touches a Railway watch path. C is the `commit` that GET /api/health reports.
// Pass rule: C equals W, or C is a descendant of W. Everything else waits, and the deadline fails.
//
// G1: nothing but that rule passes. A timeout, a network error, a non-200 answer, a body without `ok: true`, an
// unknown, malformed or missing C, a failed git call and a failed runs listing all wait or fail, never pass.
//
// The watch paths live in railway-watch-paths.json, a mirror of the Railway dashboard (G4): a change to one is made
// in both. Usage: GITHUB_SHA=<M> GITHUB_RUN_ID=<id> GITHUB_REPOSITORY=<owner/repo> GITHUB_TOKEN=<token> \
//   node scripts/ci/production-gate.mjs
// Exit: 0 passed | 1 failed or timed out | (any thrown error is also exit 1, never 0).

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const HEALTH_URL = "https://devspace-lms.vercel.app/api/health";
export const DEADLINE_MS = 20 * 60 * 1000;
export const POLL_MS = 15 * 1000;

const SHA = /^[0-9a-f]{40}$/;
// Statuses of a workflow run that has not ended; only `completed` is terminal.
const TERMINAL_STATUS = "completed";

/**
 * The dashboard shows a watch pattern with a leading `/` for the repository root. A git pathspec has no such
 * root marker, and `:(glob)` makes `**` and `*` behave like Railway's globs.
 * @param {string} pattern
 */
export function toPathspec(pattern) {
  if (
    typeof pattern !== "string" ||
    !pattern.startsWith("/") ||
    pattern.length < 2
  ) {
    throw new Error(
      `watch path "${String(pattern)}" must start with "/" and name a path`,
    );
  }
  return `:(glob)${pattern.slice(1)}`;
}

/** @param {unknown} patterns */
export function toPathspecs(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0)
    throw new Error("the watch path list is empty or not an array");
  return patterns.map(toPathspec);
}

/**
 * The pass rule, pure apart from the injected git reads.
 * @param {{ W: string, C: unknown, git: { has: (sha: string) => boolean, isAncestor: (ancestor: string, descendant: string) => boolean } }} input
 * @returns {{ pass: true, reason: string } | { pass: false, reason: "malformed" | "unknown-commit" | "behind-or-unrelated", detail: string }}
 */
export function decide({ W, C, git }) {
  if (typeof C !== "string" || !SHA.test(C)) {
    return {
      pass: false,
      reason: "malformed",
      detail: `the reported commit ${JSON.stringify(C)} is not a full SHA`,
    };
  }
  if (C === W) return { pass: true, reason: "equal" };
  if (!git.has(C)) {
    return {
      pass: false,
      reason: "unknown-commit",
      detail: `the reported commit ${C} is not in the history`,
    };
  }
  if (git.isAncestor(W, C)) return { pass: true, reason: "descendant" };
  return {
    pass: false,
    reason: "behind-or-unrelated",
    detail: `the reported commit ${C} is not at or after ${W}`,
  };
}

/**
 * The ordering rule (AC2): never pass before an earlier first-parent commit's run ended, and never after a later
 * one passed. The caller must have excluded nothing: this drops the run's own ID.
 * @param {{ runs: Array<{ id: number, head_sha: string, status: string, conclusion: string | null }>, ownRunId: number, relation: (sha: string) => "earlier" | "later" | "other" }} input
 * @returns {{ kind: "ok" } | { kind: "superseded", sha: string } | { kind: "wait", run: { id: number, head_sha: string, status: string } }}
 */
export function checkOrder({ runs, ownRunId, relation }) {
  const others = runs.filter((run) => run.id !== ownRunId);
  const passedLater = others.find(
    (run) =>
      relation(run.head_sha) === "later" &&
      run.status === TERMINAL_STATUS &&
      run.conclusion === "success",
  );
  if (passedLater) return { kind: "superseded", sha: passedLater.head_sha };
  const earlierOpen = others.find(
    (run) =>
      relation(run.head_sha) === "earlier" && run.status !== TERMINAL_STATUS,
  );
  if (earlierOpen) return { kind: "wait", run: earlierOpen };
  return { kind: "ok" };
}

/**
 * The polling loop. Every dependency is injected so a test drives it with a fake clock.
 * @param {{
 *   M: string, W: string | null, ownRunId: number, healthUrl?: string, deadlineMs?: number, pollMs?: number,
 *   deps: {
 *     now: () => number,
 *     sleep: (ms: number) => Promise<void>,
 *     fetchHealth: (url: string) => Promise<{ status: number, body: unknown, server?: string | null }>,
 *     listRuns: () => Promise<Array<{ id: number, head_sha: string, status: string, conclusion: string | null }>>,
 *     git: {
 *       has: (sha: string) => boolean,
 *       isAncestor: (ancestor: string, descendant: string) => boolean,
 *       fetchMain: () => void,
 *       orderSets: () => { earlier: Set<string>, later: Set<string> },
 *     },
 *     log?: (line: string) => void,
 *   },
 * }} input
 * @returns {Promise<{ pass: boolean, message: string }>}
 */
export async function runGate({
  M,
  W,
  ownRunId,
  healthUrl = HEALTH_URL,
  deadlineMs = DEADLINE_MS,
  pollMs = POLL_MS,
  deps,
}) {
  // No watch-path commit in M's history means the gate cannot tell what the API must report: fail before any poll.
  if (W === null) {
    return {
      pass: false,
      message: `production-gate failed: no commit at or before ${M} touches a Railway watch path`,
    };
  }
  const { now, sleep, fetchHealth, listRuns, git } = deps;
  const log = deps.log ?? (() => {});
  const deadline = now() + deadlineMs;
  const state = {
    lastC: "none",
    lastAnswer: "no answer yet",
    lastServer: "n/a",
    waitingOn: "",
    refetched: new Set(),
  };

  // The deadline is checked before every poll and again before a pass is returned, so a poll that starts or ends
  // after it never passes (AC2: at the deadline the run exits non-zero). The sleep is capped at the time left.
  let lastNote = "no poll ran";
  for (;;) {
    if (now() >= deadline) return timedOut(lastNote);
    const outcome = await pollOnce();
    if (outcome.done) {
      if (outcome.result.pass && now() >= deadline) {
        return timedOut("the deadline passed while the last check was running");
      }
      return outcome.result;
    }
    lastNote = outcome.note;
    log(outcome.note);
    const left = deadline - now();
    if (left <= 0) return timedOut(lastNote);
    await sleep(Math.min(pollMs, left));
  }

  /** @param {string} note */
  function timedOut(note) {
    const blocker = state.waitingOn ? ` Waiting on ${state.waitingOn}.` : "";
    return {
      pass: false,
      message:
        `production-gate timed out: M=${M} W=${W} last reported commit=${state.lastC} ` +
        `last answer=${state.lastAnswer} server=${state.lastServer}. ${note}.${blocker}`,
    };
  }

  async function pollOnce() {
    state.waitingOn = "";
    let answer;
    try {
      answer = await fetchHealth(healthUrl);
    } catch (error) {
      state.lastAnswer = `error: ${error instanceof Error ? error.message : String(error)}`;
      return wait("the health request failed");
    }
    state.lastAnswer = `HTTP ${answer.status}`;
    state.lastServer = answer.server ?? "n/a";
    const body = /** @type {{ ok?: unknown, commit?: unknown } | null} */ (
      answer.body
    );
    if (answer.status !== 200 || !body || body.ok !== true)
      return wait("the health answer is not 200 with ok: true");
    state.lastC =
      typeof body.commit === "string" ? body.commit : String(body.commit);

    let verdict;
    try {
      verdict = decide({ W, C: body.commit, git });
      // A commit Railway reports can be newer than the checkout's view of main: fetch once per distinct value.
      if (
        !verdict.pass &&
        verdict.reason === "unknown-commit" &&
        !state.refetched.has(state.lastC)
      ) {
        state.refetched.add(state.lastC);
        try {
          git.fetchMain();
        } catch {
          // A failed fetch leaves the commit unknown, which waits.
        }
        verdict = decide({ W, C: body.commit, git });
      }
    } catch (error) {
      return wait(
        `a git read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!verdict.pass) return wait(verdict.detail);

    // Ordering last, with nothing awaited after it, so the pass follows the check it just made.
    let runs;
    try {
      runs = await listRuns();
    } catch (error) {
      return wait(
        `the runs listing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let order;
    try {
      const sets = git.orderSets();
      order = checkOrder({
        runs,
        ownRunId,
        relation: (sha) =>
          sets.earlier.has(sha)
            ? "earlier"
            : sets.later.has(sha)
              ? "later"
              : "other",
      });
    } catch (error) {
      return wait(
        `a git read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (order.kind === "superseded") {
      return {
        done: true,
        result: {
          pass: false,
          message: `production-gate superseded by ${order.sha}: a later merge's check already passed`,
        },
      };
    }
    if (order.kind === "wait") {
      state.waitingOn = `earlier run ${order.run.id} (${order.run.head_sha}, ${order.run.status})`;
      return wait(`an earlier merge's check is still ${order.run.status}`);
    }
    return {
      done: true,
      result: {
        pass: true,
        message: `production-gate passed: the API reports ${state.lastC} (${verdict.reason} of W=${W}), M=${M}`,
      },
    };
  }

  /** @param {string} note */
  function wait(note) {
    return { done: false, note };
  }
}

/**
 * Real git reads, run in the checkout of M.
 * @param {string} M
 */
export function createGit(M, cwd = process.cwd()) {
  /** @param {string[]} args */
  const run = (args) => spawnSync("git", args, { encoding: "utf8", cwd });
  /** @param {string[]} args */
  const out = (args) =>
    execFileSync("git", args, { encoding: "utf8", cwd }).trim();
  /** @param {string[]} args */
  const lines = (args) => out(args).split("\n").filter(Boolean);
  return {
    has(sha) {
      const result = run(["cat-file", "-e", `${sha}^{commit}`]);
      if (result.status === 0) return true;
      if (result.status === 1 || result.status === 128) return false;
      throw new Error(`git cat-file failed (${result.status})`);
    },
    isAncestor(ancestor, descendant) {
      const result = run(["merge-base", "--is-ancestor", ancestor, descendant]);
      if (result.status === 0) return true;
      if (result.status === 1) return false;
      throw new Error(
        `git merge-base failed (${result.status}): ${result.stderr}`,
      );
    },
    fetchMain() {
      out([
        "fetch",
        "--no-tags",
        "origin",
        "+refs/heads/main:refs/remotes/origin/main",
      ]);
    },
    // Earlier: on M's first-parent line before M. Later: on main's first-parent line after M. Anything else
    // (a run for another branch's commit) is neither. One fetch and two listings per call, taken right before the
    // ordering check so a merge that landed since the last poll is seen.
    orderSets() {
      out([
        "fetch",
        "--no-tags",
        "origin",
        "+refs/heads/main:refs/remotes/origin/main",
      ]);
      const earlier = new Set(lines(["rev-list", "--first-parent", M]));
      earlier.delete(M);
      const later = new Set(
        lines(["rev-list", "--first-parent", `${M}..refs/remotes/origin/main`]),
      );
      return { earlier, later };
    },
  };
}

/**
 * W: the latest commit on M's first-parent line whose change against its first parent touches a watch path.
 * @param {string} M
 * @param {string[]} pathspecs
 * @returns {string | null}
 */
export function findWatchCommit(M, pathspecs, cwd = process.cwd()) {
  const found = execFileSync(
    "git",
    ["log", "-1", "--first-parent", "--format=%H", M, "--", ...pathspecs],
    {
      encoding: "utf8",
      cwd,
    },
  ).trim();
  return found === "" ? null : found;
}

/** @param {string} url */
async function fetchHealthReal(url) {
  const response = await fetch(`${url}?gate=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
    signal: AbortSignal.timeout(10_000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON answer stays null and waits.
  }
  return {
    status: response.status,
    body,
    server: response.headers.get("server"),
  };
}

// Every page of the workflow's runs, newest first, so an old run's ordering check cannot miss a later success that
// sits beyond the first page. The request carries no `branch` or `event` filter: GitHub returns at most 1000 results
// for a filtered listing and then empty pages, which would end the walk with history missing. The workflow runs only on
// push to main, so the unfiltered listing is the same set; a run that positively names another branch or event is
// dropped locally, and one whose fields are missing is kept, because dropping an unknown run could hide an earlier
// run that is still in progress (the unsafe direction). Any failed page throws: the caller waits and never reads a
// partial listing as "no earlier run in progress". The page cap only stops a runaway loop and also throws.
export const RUNS_PER_PAGE = 100;
const MAX_RUN_PAGES = 50;

/**
 * @param {{ repository: string, token: string, fetchImpl?: typeof fetch, perPage?: number }} input
 */
export function createListRuns({
  repository,
  token,
  fetchImpl = fetch,
  perPage = RUNS_PER_PAGE,
}) {
  return async () => {
    if (!repository || !token)
      throw new Error("GITHUB_REPOSITORY or GITHUB_TOKEN is missing");
    /** @type {Array<{ id: number, head_sha: string, status: string, conclusion: string | null }>} */
    const runs = [];
    for (let page = 1; page <= MAX_RUN_PAGES; page++) {
      const response = await fetchImpl(
        `https://api.github.com/repos/${repository}/actions/workflows/production-gate.yml/runs?per_page=${perPage}&page=${page}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.status !== 200)
        throw new Error(
          `the runs API answered ${response.status} on page ${page}`,
        );
      const data = await response.json();
      if (!data || !Array.isArray(data.workflow_runs)) {
        throw new Error(
          `the runs API answered without workflow_runs on page ${page}`,
        );
      }
      for (const run of data.workflow_runs) {
        const otherBranch =
          typeof run?.head_branch === "string" && run.head_branch !== "main";
        const otherEvent =
          typeof run?.event === "string" && run.event !== "push";
        if (!otherBranch && !otherEvent) runs.push(run);
      }
      // The raw page size decides the end, not the filtered one.
      if (data.workflow_runs.length < perPage) return runs;
    }
    throw new Error(`the runs listing has more than ${MAX_RUN_PAGES} pages`);
  };
}

async function main() {
  try {
    const M = process.env.GITHUB_SHA ?? "";
    if (!SHA.test(M)) throw new Error("GITHUB_SHA is not a full SHA");
    const ownRunId = Number(process.env.GITHUB_RUN_ID);
    if (!Number.isInteger(ownRunId))
      throw new Error("GITHUB_RUN_ID is not an integer");
    const patterns = JSON.parse(
      readFileSync(
        new URL("./railway-watch-paths.json", import.meta.url),
        "utf8",
      ),
    );
    const W = findWatchCommit(M, toPathspecs(patterns));
    const result = await runGate({
      M,
      W,
      ownRunId,
      deps: {
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        fetchHealth: fetchHealthReal,
        listRuns: createListRuns({
          repository: process.env.GITHUB_REPOSITORY ?? "",
          token: process.env.GITHUB_TOKEN ?? "",
        }),
        git: createGit(M),
        log: (line) =>
          process.stdout.write(`${new Date().toISOString()} ${line}\n`),
      },
    });
    (result.pass ? process.stdout : process.stderr).write(
      `${result.message}\n`,
    );
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `production-gate failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
