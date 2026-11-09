// Test plan
// Goal: the fixture pages (`*.e2e.tsx`) are routes only when the e2e build sets E2E_NEXT_FIXTURES, so a production build
//   has none of them (TM-U3 AC20).
// Layer: unit. next.config.ts is imported with the variable unset, empty, set to something else and set to "1".
// Subject: AC20 of the TM-U3 plan. The e2e build itself is __tests__/e2e/api-topology.spec.ts.
import { afterEach, describe, expect, it, vi } from "vitest";

async function extensions(value?: string) {
  vi.resetModules();
  if (value === undefined)
    vi.stubEnv("E2E_NEXT_FIXTURES", undefined as unknown as string);
  else vi.stubEnv("E2E_NEXT_FIXTURES", value);
  return (await import("../../next.config")).default.pageExtensions;
}

afterEach(() => vi.unstubAllEnvs());

describe("next.config page extensions", () => {
  it.each([undefined, "", "0", "true", "yes"])(
    "has no fixture extension when E2E_NEXT_FIXTURES is %j",
    async (value) => {
      expect(await extensions(value)).toEqual(["tsx", "ts", "jsx", "js"]);
    },
  );

  it('adds the fixture extension only for "1", the value the e2e environment map sets', async () => {
    expect(await extensions("1")).toEqual([
      "tsx",
      "ts",
      "jsx",
      "js",
      "e2e.tsx",
    ]);
  });
});
