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

// Reads one Set-Cookie line: a cookie that is emptied or has no life left is a deletion, anything else a replacement.
function readSetCookie(line) {
  const [pair, ...attributes] = line.split(";");
  const at = pair.indexOf("=");
  if (at <= 0) return null;
  const value = pair.slice(at + 1).trim();
  const deletion =
    value === "" ||
    attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));
  return { name: pair.slice(0, at).trim(), value, deletion };
}

// The Supabase session cookie and its chunks (`sb-<ref>-auth-token`, `sb-<ref>-auth-token.0`, ...). Any other cookie
// (a preference, a tracker) says nothing about a refresh.
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function isSessionCookieReplacement(line) {
  const cookie = readSetCookie(line);
  return (
    cookie !== null && !cookie.deletion && SESSION_COOKIE.test(cookie.name)
  );
}

function applySetCookie(jar, lines) {
  for (const line of lines) {
    const cookie = readSetCookie(line);
    if (!cookie) continue;
    if (cookie.deletion) jar.delete(cookie.name);
    else jar.set(cookie.name, cookie.value);
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
  // A browser stores the cookies of an answer when its headers arrive, before the body is consumed, so `onHeaders` runs
  // between the two and the jar follows header arrival order, not launch order or body order.
  const ask = async (header, onHeaders) => {
    const response = await fetchImpl(url, {
      headers: { cookie: header },
      redirect: "manual",
    });
    const setCookies = response.headers.getSetCookie();
    onHeaders?.(setCookies);
    await response.arrayBuffer();
    return { status: response.status, setCookies };
  };

  const jar = parseCookieHeader(cookie);
  const answers = await Promise.all(
    Array.from({ length: parallel }, () =>
      ask(cookie, (setCookies) => applySetCookie(jar, setCookies)),
    ),
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

  // Without a refresh there was no contention to survive, so 200 everywhere proves nothing.
  const refreshed = answers.filter(({ setCookies }) =>
    setCookies.some(isSessionCookieReplacement),
  ).length;
  check(
    "T5 at least one answer replaced a session cookie, so a refresh really ran",
    refreshed > 0,
    `${refreshed} of ${answers.length} answers replaced a session cookie`,
  );
  const follow = await ask(toHeader(jar));
  check(
    "T5 the session is still usable afterwards with the cookies the answers set",
    follow.status === 200,
    `status ${follow.status}`,
  );
  return { lines, failed };
}
