import { API_TEMPORARY_ROUTES, APP_TEMPORARY_PAGES } from "./routes.mjs";

// Verify mode: takes no cookie and no token, so it asks what an anonymous caller meets. Every temporary surface must
// answer 404; with the flag off that is what the API gives (the routes do not exist) and what the Next page gives
// (the API says 404 for it). Any other status, 401 included, means the surface is still there and fails the check.
// A request that cannot be made fails it too: silence is not "absent".
/** @param {{ apiBase: string, appBase?: string, fetchImpl?: typeof fetch }} options */
export async function verifyAbsent({ apiBase, appBase, fetchImpl = fetch }) {
  const targets = [
    ...API_TEMPORARY_ROUTES.map(({ method, path }) => ({
      method,
      url: new URL(path, apiBase).href,
    })),
    ...(appBase
      ? [
          ...APP_TEMPORARY_PAGES.map((path) => ({
            method: "GET",
            url: new URL(path, appBase).href,
          })),
          // The same paths through the rewrite: the Next app must pass the API's 404 on unchanged.
          ...API_TEMPORARY_ROUTES.map(({ method, path }) => ({
            method,
            url: new URL(path, appBase).href,
          })),
        ]
      : []),
  ];
  const failures = [];
  for (const { method, url } of targets) {
    try {
      const response = await fetchImpl(url, {
        method,
        redirect: "manual",
        headers: {},
      });
      await response.body?.cancel();
      if (response.status !== 404) {
        failures.push({ method, url, status: response.status });
      }
    } catch (error) {
      failures.push({
        method,
        url,
        status: `no answer (${error instanceof Error ? error.message : String(error)})`,
      });
    }
  }
  return { checked: targets.length, failures };
}
