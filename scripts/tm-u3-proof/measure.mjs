// Measure mode (plan M1): latency of the hops one request can take, from the machine that runs it. Prints counts,
// statuses and milliseconds only, never a body, a cookie or a token.
export const BUDGET_NOW = { apiP95: 300, endToEndP95: 600 }; // ADR 0008 D11, database in Sydney (TM-U3 to TM-U10)
export const BUDGET_AFTER_TM_U11 = { apiP95: 150, endToEndP95: 400 };

export function percentile(values, p) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

// The span the temporary routes report (`Server-Timing: api;dur=<ms>`); undefined for any other route.
export function parseApiMs(header) {
  const match = /(?:^|,\s*)api;dur=(\d+(?:\.\d+)?)/.exec(header ?? "");
  return match ? Number(match[1]) : undefined;
}

const round = (value) =>
  Number.isNaN(value) ? "n/a" : String(Math.round(value));

/**
 * @param {{ apiBase: string, origin: string, cookie: string, sequential?: number, concurrent?: number,
 *   proxyPath?: string, fetchImpl?: typeof fetch, now?: () => number }} options
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
}) {
  const lines = [];
  let failed = 0;
  const headers = { cookie };
  // At-the-API spans per target and mode, kept for the Auth round trip lines at the end.
  const spans = {};
  // `proxy.ts` runs getUser() on every request it handles, so a page that makes no API call measures that check alone.
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
    },
    {
      name: "GET /api/proof/session-cold (cold cache)",
      url: new URL("/api/proof/session-cold", apiBase).href,
    },
    {
      name: `GET ${proxyPath} (the proxy.ts check alone)`,
      url: new URL(proxyPath, origin).href,
    },
    {
      name: "GET /api/proof/read (two queries)",
      url: new URL("/api/proof/read", apiBase).href,
      budget: true,
    },
  ];

  async function sample(url) {
    const started = now();
    const response = await fetchImpl(url, { headers, redirect: "manual" });
    await response.arrayBuffer();
    return {
      status: response.status,
      endToEnd: now() - started,
      api: parseApiMs(response.headers.get("server-timing")),
    };
  }

  for (const target of targets) {
    if (target.prime) await sample(target.url); // the first call fills the cache; it is not a sample
    for (const [mode, count] of [
      ["sequential", sequential],
      ["concurrent", concurrent],
    ]) {
      const samples = [];
      if (mode === "sequential") {
        for (let index = 0; index < count; index += 1)
          samples.push(await sample(target.url));
      } else {
        samples.push(
          ...(await Promise.all(
            Array.from({ length: count }, () => sample(target.url)),
          )),
        );
      }
      const ok = samples.filter(
        (item) => item.status >= 200 && item.status < 300,
      ).length;
      const e2e = samples.map((item) => item.endToEnd);
      const api = samples.flatMap((item) =>
        item.api === undefined ? [] : [item.api],
      );
      (spans[target.name] ??= {})[mode] = api;
      const good = ok === samples.length;
      if (!good) failed += 1;
      lines.push(
        `${good ? "PASS" : "FAIL"} MEASURE ${target.name} ${mode} n=${samples.length} ok=${ok}: end to end p50 ${round(percentile(e2e, 50))} ms, p95 ${round(percentile(e2e, 95))} ms; at the API ${api.length === 0 ? "n/a" : `p50 ${round(percentile(api, 50))} ms, p95 ${round(percentile(api, 95))} ms`}`,
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
  // M2's `/auth/v1/user` round trip: the cold route asks Auth on every call and the warm one hits the cache, so the
  // difference of their at-the-API p50 is the round trip. Both routes answer the proof owner (the cookie's user) only,
  // which is why the fixture tokens of session-probe cannot supply it.
  for (const mode of ["sequential", "concurrent"]) {
    const cold =
      spans["GET /api/proof/session-cold (cold cache)"]?.[mode] ?? [];
    const warm = spans["GET /api/session (warm cache)"]?.[mode] ?? [];
    if (cold.length === 0 || warm.length === 0) {
      lines.push(
        `INFO AUTH ROUND TRIP ${mode}: n/a, ${cold.length === 0 ? "/api/proof/session-cold" : "/api/session"} has no Server-Timing span`,
      );
      continue;
    }
    const coldP50 = percentile(cold, 50);
    const warmP50 = percentile(warm, 50);
    lines.push(
      `INFO AUTH ROUND TRIP ${mode}: at the API without the cache p50 ${round(coldP50)} ms, p95 ${round(percentile(cold, 95))} ms; with the cache p50 ${round(warmP50)} ms, p95 ${round(percentile(warm, 95))} ms; round trip (p50 difference) ${round(coldP50 - warmP50)} ms`,
    );
  }
  return { lines, failed };
}
