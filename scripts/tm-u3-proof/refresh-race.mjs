// Proof T5: many requests that carry the same expired session cookie arrive together, so each one makes `proxy.ts`
// refresh the session. The check is that the session is still usable afterwards, with the cookies the answers set (the
// cookie of the Owner's terminal when none was set). It prints counts and statuses only, never a cookie value.
const SESSION_PATH = "/api/session";

function parseCookieHeader(header) {
  const jar = new Map();
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at > 0) jar.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return jar;
}

// Applies the Set-Cookie lines of one answer: a cookie that is emptied or has no life left is dropped.
function applySetCookie(jar, lines) {
  for (const line of lines) {
    const [pair, ...attributes] = line.split(";");
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    const name = pair.slice(0, at).trim();
    const value = pair.slice(at + 1).trim();
    const gone =
      value === "" ||
      attributes.some((attribute) =>
        /^\s*max-age\s*=\s*0\s*$/i.test(attribute),
      );
    if (gone) jar.delete(name);
    else jar.set(name, value);
  }
}

const toHeader = (jar) =>
  [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

/** @param {{ origin: string, cookie: string, parallel?: number, fetchImpl?: typeof fetch }} options */
export async function runRefreshRace({
  origin,
  cookie,
  parallel = 20,
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
  const url = new URL(SESSION_PATH, origin).href;
  const ask = async (header) => {
    const response = await fetchImpl(url, {
      headers: { cookie: header },
      redirect: "manual",
    });
    await response.arrayBuffer();
    return {
      status: response.status,
      setCookies: response.headers.getSetCookie(),
    };
  };

  const answers = await Promise.all(
    Array.from({ length: parallel }, () => ask(cookie)),
  );
  const counts = new Map();
  for (const { status } of answers)
    counts.set(status, (counts.get(status) ?? 0) + 1);
  const summary = [...counts]
    .map(([status, n]) => `${status} x${n}`)
    .join(", ");
  check(
    `T5 ${parallel} parallel requests with an expired cookie all succeed`,
    answers.every(({ status }) => status === 200),
    summary,
  );

  const jar = parseCookieHeader(cookie);
  for (const { setCookies } of answers) applySetCookie(jar, setCookies);
  const refreshed = answers.filter(
    ({ setCookies }) => setCookies.length > 0,
  ).length;
  const follow = await ask(toHeader(jar));
  check(
    "T5 the session is still usable afterwards with the cookies the answers set",
    follow.status === 200,
    `status ${follow.status}; ${refreshed} of ${answers.length} answers set cookies`,
  );
  return { lines, failed };
}
