import { isSessionCookieReplacement } from "./refresh-race.mjs";

// Measure mode (plan M1): latency of the hops one request can take, from the machine that runs it. Prints counts,
// statuses and milliseconds only, never a body, a cookie or a token.
export const BUDGET_NOW = { apiP95: 300, endToEndP95: 600 }; // ADR 0008 D11, database in Sydney (TM-U3 to TM-U10)
export const BUDGET_AFTER_TM_U11 = { apiP95: 150, endToEndP95: 400 };

// The session cache keeps an entry 30 seconds after the call that missed and a hit does not extend it (session-cache.ts),
// so a warm sample is only warm for a while after a miss, and a refill call made while the entry is still alive is a hit
// that changes nothing. Warm sampling therefore stops after WARM_WINDOW_MS, waits until the entry is certainly gone
// (EXPIRY_WAIT_MS after the last priming call ended) and refills it with an unsampled call.
const WARM_WINDOW_MS = 20_000;
const EXPIRY_WAIT_MS = 31_000;

export function percentile(values, p) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

// Every span the temporary routes report (`Server-Timing: api;dur=<ms>`); empty for any other route.
export function parseApiSpans(header) {
  return [...(header ?? "").matchAll(/(?:^|,\s*)api;dur=(\d+(?:\.\d+)?)/g)].map(
    (match) => Number(match[1]),
  );
}

export function parseApiMs(header) {
  return parseApiSpans(header)[0];
}

const round = (value) =>
  Number.isNaN(value) ? "n/a" : String(Math.round(value));

const answeredOk = (text) => {
  try {
    return JSON.parse(text)?.ok === true;
  } catch {
    return false;
  }
};

/**
 * @param {{ apiBase: string, origin: string, cookie: string, sequential?: number, concurrent?: number,
 *   proxyPath?: string, fetchImpl?: typeof fetch, now?: () => number, sleep?: (ms: number) => Promise<void> }} options
 */
export async function measure({
  apiBase,
  origin,
  cookie,
  sequential = 100,
  concurrent = 20,
  proxyPath = "/login",
  fetchImpl = fetch,
  now = () => performance.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const lines = [];
  let failed = 0;
  const headers = { cookie };
  // At-the-API spans per target and mode, kept for the Auth cost estimate at the end; only complete batches are kept.
  const spans = {};
  // `span: true` marks the temporary routes, which always send exactly one span; a sample without it fails the batch.
  // `expectOk` marks the route whose 200 can still be the shorter `{ ok: false }` path.
  // A page that makes no API call is not getUser() in isolation: it is the proxy.ts check plus delivery of the page.
  const targets = [
    { name: "GET /api/health", url: new URL("/api/health", apiBase).href },
    {
      name: "GET /api/health/db",
      url: new URL("/api/health/db", apiBase).href,
    },
    {
      name: "GET /api/session (warm cache)",
      url: new URL("/api/session", apiBase).href,
      prime: true,
      span: true,
    },
    {
      name: "GET /api/proof/session-cold (cold cache)",
      url: new URL("/api/proof/session-cold", apiBase).href,
      span: true,
    },
    {
      name: `GET ${proxyPath} (page with no API call: the proxy.ts check plus delivery)`,
      url: new URL(proxyPath, origin).href,
    },
    {
      name: "GET /api/proof/read (two queries)",
      url: new URL("/api/proof/read", apiBase).href,
      budget: true,
      span: true,
      expectOk: true,
    },
  ];

  async function sample(target) {
    const started = now();
    const response = await fetchImpl(target.url, {
      headers,
      redirect: "manual",
    });
    const text = await response.text();
    const status = response.status;
    const spans = parseApiSpans(response.headers.get("server-timing"));
    return {
      status,
      endToEnd: now() - started,
      spans,
      // The script keeps sending the cookie it was given, so an answer that replaces the session cookie means the
      // token expired mid-run and every later sample belongs to a session the script is no longer using.
      replaced: response.headers
        .getSetCookie()
        .some(isSessionCookieReplacement),
      valid:
        status >= 200 && status < 300 && (!target.expectOk || answeredOk(text)),
      // A priming call must look like a sample: a valid 2xx, and one span where the route sends one.
      usable:
        status >= 200 &&
        status < 300 &&
        (!target.expectOk || answeredOk(text)) &&
        (!target.span || spans.length === 1),
    };
  }

  // The cache may hold an entry from an earlier run that is about to expire, so the run starts as if a priming call
  // had just ended: the first one waits for expiry like the later ones.
  const startedAt = now();
  for (const target of targets) {
    let primedAt = Number.NEGATIVE_INFINITY;
    let primeEnded = startedAt;
    const prime = { failed: 0, replaced: 0 };
    // Unsampled: it fills the cache for the warm route and is not a measurement. When the last fill is older than the
    // warm window it waits for that entry to expire first, so this call is a miss that refills rather than a hit.
    const keepWarm = async () => {
      if (now() - primedAt <= WARM_WINDOW_MS) return;
      const wait = EXPIRY_WAIT_MS - (now() - primeEnded);
      if (wait > 0) await sleep(wait);
      primedAt = now();
      const result = await sample(target);
      primeEnded = now();
      if (!result.usable) prime.failed += 1;
      if (result.replaced) prime.replaced += 1;
    };
    for (const [mode, count] of [
      ["sequential", sequential],
      ["concurrent", concurrent],
    ]) {
      prime.failed = 0;
      prime.replaced = 0;
      if (target.prime) await keepWarm();
      const samples = [];
      if (mode === "sequential") {
        for (let index = 0; index < count; index += 1) {
          if (target.prime) await keepWarm();
          samples.push(await sample(target));
        }
      } else {
        samples.push(
          ...(await Promise.all(
            Array.from({ length: count }, () => sample(target)),
          )),
        );
      }
      const valid = samples.filter((item) => item.valid);
      const withSpan = valid.filter((item) => item.spans.length === 1);
      const e2e = samples.map((item) => item.endToEnd);
      const api = withSpan.map((item) => item.spans[0]);
      const spansOk = !target.span || withSpan.length === valid.length;
      const replaced =
        samples.filter((item) => item.replaced).length + prime.replaced;
      const good =
        valid.length === samples.length &&
        spansOk &&
        prime.failed === 0 &&
        replaced === 0;
      if (!good) failed += 1;
      if (good) (spans[target.name] ??= {})[mode] = api;
      const problems = [
        spansOk
          ? ""
          : `, ${valid.length - withSpan.length} without exactly one Server-Timing span`,
        prime.failed === 0
          ? ""
          : `, ${prime.failed} priming call(s) failed (not a valid 2xx with one span)`,
        replaced === 0
          ? ""
          : `, the session cookie was replaced ${replaced} time(s): the token expired during the run, sign in again and rerun`,
      ].join("");
      lines.push(
        `${good ? "PASS" : "FAIL"} MEASURE ${target.name} ${mode} n=${samples.length} ok=${valid.length}${problems}: end to end p50 ${round(percentile(e2e, 50))} ms, p95 ${round(percentile(e2e, 95))} ms; at the API ${api.length === 0 ? "n/a" : `p50 ${round(percentile(api, 50))} ms, p95 ${round(percentile(api, 95))} ms`}`,
      );
      if (target.budget && good) {
        const apiP95 = percentile(api, 95);
        const e2eP95 = percentile(e2e, 95);
        for (const [label, budget, hard] of [
          ["TM-U3 to TM-U10", BUDGET_NOW, true],
          ["after TM-U11", BUDGET_AFTER_TM_U11, false],
        ]) {
          const within =
            apiP95 <= budget.apiP95 && e2eP95 <= budget.endToEndP95;
          if (hard && !within) failed += 1;
          lines.push(
            `${within ? "PASS" : hard ? "FAIL" : "INFO"} BUDGET ${target.name} ${mode} against the ${label} budget (API p95 <= ${budget.apiP95} ms, end to end p95 <= ${budget.endToEndP95} ms): API p95 ${round(apiP95)} ms, end to end p95 ${round(e2eP95)} ms`,
          );
        }
      }
    }
  }
  // M2's added Auth cost: the cold route asks Auth on every call and the warm one hits the cache, so the difference of
  // their at-the-API p50 estimates what the `/auth/v1/user` call adds. It is an estimate, not a timed round trip. Both
  // routes answer the proof owner (the cookie's user) only, which is why the fixture tokens of session-probe cannot
  // supply it. A route whose batch failed has no estimate; its FAIL line above says why.
  for (const mode of ["sequential", "concurrent"]) {
    const cold = spans["GET /api/proof/session-cold (cold cache)"]?.[mode];
    const warm = spans["GET /api/session (warm cache)"]?.[mode];
    if (!cold?.length || !warm?.length) {
      lines.push(
        `INFO AUTH COST ESTIMATE ${mode}: n/a, a session route has no complete Server-Timing batch (see the FAIL line)`,
      );
      continue;
    }
    const coldP50 = percentile(cold, 50);
    const warmP50 = percentile(warm, 50);
    lines.push(
      `INFO AUTH COST ESTIMATE ${mode}: at the API without the cache p50 ${round(coldP50)} ms, p95 ${round(percentile(cold, 95))} ms; with the cache p50 ${round(warmP50)} ms, p95 ${round(percentile(warm, 95))} ms; estimated added Auth cost (p50 difference, not a directly timed /auth/v1/user round trip) ${round(coldP50 - warmP50)} ms`,
    );
  }
  return { lines, failed };
}
