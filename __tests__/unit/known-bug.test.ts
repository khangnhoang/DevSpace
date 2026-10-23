import { expect as playwrightExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { runKnownBug } from "../helpers/known-bug";

describe("runKnownBug with the error of Playwright's expect", () => {
  // knownBugE2e wraps this same function; Playwright's `expect` throws a plain Error with a `matcherResult`,
  // not an AssertionError, and it also runs outside a test for a non-web matcher.
  it("passes and reports the bug while the correct-behavior assertion fails", async () => {
    const reports: string[] = [];
    await runKnownBug(
      "P99",
      async (bug) => {
        playwrightExpect(1).toBe(1);
        await bug(() => playwrightExpect("allowed").toBe("denied"));
      },
      (message) => {
        reports.push(message);
      },
    );
    expect(reports).toEqual(["known bug P99"]);
  });

  it("fails with a turn-it-into-a-normal-test message once the correct-behavior assertion holds", async () => {
    await expect(runKnownBug("P99", async (bug) => bug(() => playwrightExpect("denied").toBe("denied")))).rejects.toThrow(
      /P99 no longer reproduces: turn this into a normal test/,
    );
  });

  it("fails on a failed precondition", async () => {
    await expect(
      runKnownBug("P99", async (bug) => {
        playwrightExpect("row missing").toBe("row present");
        await bug(() => playwrightExpect(1).toBe(2));
      }),
    ).rejects.toThrow(/row present/);
  });

  it("fails on a TypeError or a plain Error inside the bug check, which are not assertion failures", async () => {
    await expect(
      runKnownBug("P99", async (bug) =>
        bug(() => {
          throw new TypeError("cannot read properties of undefined");
        }),
      ),
    ).rejects.toThrow(TypeError);
    await expect(
      runKnownBug("P99", async (bug) =>
        bug(() => {
          throw new Error("network down");
        }),
      ),
    ).rejects.toThrow(/network down/);
  });
});

describe("runKnownBug", () => {
  it("passes and reports the bug while the correct-behavior assertion fails", async () => {
    const reports: string[] = [];
    await runKnownBug(
      "P99",
      async (bug) => {
        expect(1).toBe(1); // a precondition that holds
        await bug(() => expect("allowed").toBe("denied"));
      },
      (message) => {
        reports.push(message);
      },
    );
    expect(reports).toEqual(["known bug P99"]);
  });

  it("waits for an asynchronous report before it finishes", async () => {
    let reported = false;
    await runKnownBug(
      "P99",
      async (bug) => bug(() => expect(1).toBe(2)),
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        reported = true;
      },
    );
    expect(reported).toBe(true);
  });

  it("fails with a turn-it-into-a-normal-test message once the correct-behavior assertion holds", async () => {
    await expect(runKnownBug("P99", async (bug) => bug(() => expect("denied").toBe("denied")))).rejects.toThrow(
      /P99 no longer reproduces: turn this into a normal test/,
    );
  });

  it("fails on a failed precondition instead of counting it as the bug", async () => {
    let bugReached = false;
    await expect(
      runKnownBug("P99", async (bug) => {
        expect("row missing").toBe("row present");
        bugReached = true;
        await bug(() => expect(1).toBe(2));
      }),
    ).rejects.toThrow(/row present/);
    expect(bugReached).toBe(false);
  });

  it("fails on a sign-in or network error thrown before the bug assertion", async () => {
    await expect(
      runKnownBug("P99", async () => {
        throw new Error("sign-in failed: HTTP 429");
      }),
    ).rejects.toThrow(/sign-in failed/);
  });

  it("fails on an error thrown inside the bug check that is not an assertion failure", async () => {
    await expect(
      runKnownBug("P99", async (bug) =>
        bug(() => {
          throw new TypeError("cannot read properties of undefined");
        }),
      ),
    ).rejects.toThrow(TypeError);
  });

  it("fails when the body never reaches its bug assertion", async () => {
    await expect(runKnownBug("P99", async () => {})).rejects.toThrow(/never reached its bug/);
  });

  it("fails when the body wraps two assertions in bug(...)", async () => {
    await expect(
      runKnownBug("P99", async (bug) => {
        await bug(() => expect(1).toBe(2));
        await bug(() => expect(1).toBe(2));
      }),
    ).rejects.toThrow(/only one assertion/);
  });
});
