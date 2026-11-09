import { parseApiMs, percentile } from "./measure.mjs";

// Session probe (plan M2), run in two steps with the Owner's action between them. The tokens are the access tokens of
// two fixture sessions, taken from the environment of the Owner's terminal and never printed.
//   --step live  : both sessions are live. Each one passes the session guard and is refused by the proof owner check
//                  (404, the user is not the proof owner), which shows the later 401 is a real change. The round trip
//                  to Supabase Auth is read from the API's own span, without the cache (the route that skips it) and
//                  with it.
//   --step after : session A was signed out and the account of B was deleted, both by the Owner: both get 401.
/** @param {{ apiBase: string, step: "live" | "after", tokens: { A: string, B: string }, samples?: number, fetchImpl?: typeof fetch }} options */
export async function runSessionProbe({
  apiBase,
  step,
  tokens,
  samples = 20,
  fetchImpl = fetch,
}) {
  const lines = [];
  let failed = 0;
  const check = (name, ok, detail) => {
    if (!ok) failed += 1;
    lines.push(
      `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`,
    );
  };
  const ask = async (path, token) => {
    const response = await fetchImpl(new URL(path, apiBase).href, {
      headers: { authorization: `Bearer ${token}` },
    });
    await response.arrayBuffer();
    return {
      status: response.status,
      api: parseApiMs(response.headers.get("server-timing")),
    };
  };
  const summary = (values) =>
    values.length === 0
      ? "no Server-Timing value"
      : `p50 ${Math.round(percentile(values, 50))} ms, p95 ${Math.round(percentile(values, 95))} ms over ${values.length}`;

  for (const slot of ["A", "B"]) {
    const token = tokens[slot];
    const cold = await ask("/api/proof/session-cold", token);
    if (step === "live") {
      check(
        `session ${slot} is live: past the session guard, refused by the proof owner check`,
        cold.status === 404,
        `status ${cold.status}`,
      );
      const withoutCache = [];
      for (let index = 0; index < samples; index += 1) {
        const result = await ask("/api/proof/session-cold", token);
        if (result.api !== undefined) withoutCache.push(result.api);
      }
      await ask("/api/session", token); // fills the cache
      const withCache = [];
      for (let index = 0; index < samples; index += 1) {
        const result = await ask("/api/session", token);
        if (result.api !== undefined) withCache.push(result.api);
      }
      lines.push(
        `INFO session ${slot} at the API, without the cache: ${summary(withoutCache)}; with the cache: ${summary(withCache)}`,
      );
    } else {
      check(
        `session ${slot} after the Owner's change: the session guard refuses it`,
        cold.status === 401,
        `status ${cold.status}`,
      );
    }
  }
  return { lines, failed };
}
