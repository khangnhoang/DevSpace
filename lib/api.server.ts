import "server-only";

import { cookies } from "next/headers";

// The one place Next code calls the API (TM-U3, ADR 0008 D5). The session reaches the API as the cookie of the incoming
// request, which proxy.ts has already refreshed, and `Origin` is the app's own origin: a server-side request carries no
// `Sec-Fetch-Site` and no browser `Origin`, and the API's CSRF guard refuses a cookie-bearing write that names neither.
// The API's address is private (`API_INTERNAL_URL`) and is read here and in proxy.ts only, never in client code.
export class ApiConfigError extends Error {}

type ApiRequest = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: BodyInit;
};

export async function apiFetch(
  path: string,
  request: ApiRequest = {},
): Promise<Response> {
  // A path is the API's own `/api/...` and nothing that could name another host.
  if (
    !/^\/api\/[A-Za-z0-9._~\-/]*(\?[A-Za-z0-9._~\-=&%]*)?$/.test(path) ||
    path.includes("..")
  ) {
    throw new ApiConfigError("apiFetch takes a path under /api/.");
  }
  const base = process.env.API_INTERNAL_URL;
  if (!base) throw new ApiConfigError("API_INTERNAL_URL is not set.");
  const appOrigin = process.env.NEXT_PUBLIC_BASE_URL;
  if (!appOrigin) throw new ApiConfigError("NEXT_PUBLIC_BASE_URL is not set.");

  const cookie = (await cookies())
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  return await fetch(new URL(path, base), {
    method: request.method ?? "GET",
    headers: {
      ...request.headers,
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: new URL(appOrigin).origin,
    },
    body: request.body,
    // The answer belongs to this caller's session, and a redirect from the API is not followed to another place.
    cache: "no-store",
    redirect: "manual",
  });
}
