// Test plan
// Goal: the temporary proof page of TM-U3 is 404 before it calls the API whenever API_PROOF_ENABLED is not exactly "1",
//   and with the flag on it still ends in 404 when the API answers 404 for one of its surfaces.
// Layer: unit. The page is an async Server Component, so it runs as a function with the API helper and `notFound`
//   replaced; its own flag check and call order run for real.
// Subject: S5 of the TM-U3 correction round; AC19, plan 1.2.
// Invariants: with the flag off no request leaves the page, also when the API's address is not configured; the page
//   prints statuses only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
class NotFound extends Error {}
vi.mock("@/lib/api.server", () => ({ apiFetch }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound("not found");
  },
}));

import TmU3ProofPage from "@/app/tm-u3-proof/page";

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(async () => new Response("{}", { status: 200 }));
  vi.stubEnv("API_INTERNAL_URL", "http://api.internal:4000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the TM-U3 proof page", () => {
  it.each([undefined, "", "0", "true", "yes", " 1", "11"])(
    "is 404 without any API call when API_PROOF_ENABLED is %j",
    async (flag) => {
      if (flag === undefined) vi.stubEnv("API_PROOF_ENABLED", undefined);
      else vi.stubEnv("API_PROOF_ENABLED", flag);
      await expect(TmU3ProofPage()).rejects.toBeInstanceOf(NotFound);
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  it("is 404 without any API call when the flag is off and the API's address is not configured either", async () => {
    vi.stubEnv("API_PROOF_ENABLED", undefined);
    vi.stubEnv("API_INTERNAL_URL", undefined);
    await expect(TmU3ProofPage()).rejects.toBeInstanceOf(NotFound);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("with the flag on asks the three surfaces with GET and lists only their statuses", async () => {
    vi.stubEnv("API_PROOF_ENABLED", "1");
    const page = await TmU3ProofPage();
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual([
      "/api/session",
      "/api/proof/session-cold",
      "/api/proof/read",
    ]);
    expect(JSON.stringify(page)).toContain("200");
  });

  it("with the flag on is still 404 when the API answers 404 for a surface", async () => {
    vi.stubEnv("API_PROOF_ENABLED", "1");
    apiFetch.mockImplementation(async (path: string) =>
      path === "/api/proof/read"
        ? new Response(null, { status: 404 })
        : new Response("{}", { status: 200 }),
    );
    await expect(TmU3ProofPage()).rejects.toBeInstanceOf(NotFound);
  });
});
