// Session probe (plan M2), run in two steps with the Owner's action between them. The tokens are the access tokens of
// two fixture sessions, taken from the environment of the Owner's terminal and never printed.
//   --step live  : both sessions are live. Each one passes the session guard and is refused by the proof owner check
//                  (404, the user is not the proof owner), which shows the later 401 is a real change. That 404
//                  deliberately carries no Server-Timing header, so no timing is read here: the Auth round trip comes
//                  from `measure`, which uses the proof owner's cookie.
//   --step after : session A was signed out and the account of B was deleted, both by the Owner: both get 401.
/** @param {{ apiBase: string, step: "live" | "after", tokens: { A: string, B: string }, fetchImpl?: typeof fetch }} options */
export async function runSessionProbe({
  apiBase,
  step,
  tokens,
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
    return { status: response.status };
  };

  for (const slot of ["A", "B"]) {
    const cold = await ask("/api/proof/session-cold", tokens[slot]);
    if (step === "live") {
      check(
        `session ${slot} is live: past the session guard, refused by the proof owner check`,
        cold.status === 404,
        `status ${cold.status}`,
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
