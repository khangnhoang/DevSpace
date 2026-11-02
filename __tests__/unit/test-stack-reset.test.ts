import { describe, expect, it } from "vitest";
import { decideReset } from "../../scripts/test-stack/ensure.mjs";

const clean = { status: "clean", resetHash: "h1" };

describe("test stack reset decision", () => {
  it("(a) resets after a run that did not finish cleanly, and for an unreadable record", () => {
    expect(decideReset({ state: { ...clean, status: "dirty", cause: "residue" }, hash: "h1", fresh: false, force: false })).toMatchObject({ reset: true, kind: "a" });
    expect(decideReset({ state: { status: "dirty", cause: "state.json cannot be parsed" }, hash: "h1", fresh: false, force: false })).toMatchObject({ reset: true, kind: "a" });
  });

  it("(b) resets when the inputs changed or no reset is recorded", () => {
    expect(decideReset({ state: clean, hash: "h2", fresh: false, force: false })).toMatchObject({ reset: true, kind: "b" });
    expect(decideReset({ state: null, hash: "h1", fresh: false, force: false })).toMatchObject({ reset: true, kind: "b" });
  });

  it("(c) counts a start without the data volume as a reset without running one", () => {
    expect(decideReset({ state: null, hash: "h1", fresh: true, force: false })).toMatchObject({ reset: false, kind: "c" });
    expect(decideReset({ state: { ...clean, status: "dirty" }, hash: "h1", fresh: true, force: false })).toMatchObject({ reset: false, kind: "c" });
  });

  it("(d) resets when asked to", () => {
    expect(decideReset({ state: clean, hash: "h1", fresh: false, force: true })).toMatchObject({ reset: true, kind: "d" });
  });

  it("does not reset an unchanged clean state, run after run", () => {
    expect(decideReset({ state: clean, hash: "h1", fresh: false, force: false })).toMatchObject({ reset: false, kind: null });
  });
});
