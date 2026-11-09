type Headers = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// ADR 0008 D5. Applies to a request that changes state and carries a cookie, because only a cookie can be sent along
// by a page the user did not choose. A request that carries no cookie (a bearer-only client) cannot be forged this way.
//   1. Sec-Fetch-Site present and not same-origin: refuse.
//   2. Origin present and not on the allow list: refuse.
//   3. Neither header: refuse.
export function csrfRefusal(
  method: string,
  headers: Headers,
  allowedOrigins: readonly string[],
): boolean {
  if (method.toUpperCase() === "GET") return false;
  const cookie = single(headers.cookie);
  if (cookie === undefined || cookie.trim() === "") return false;
  const site = single(headers["sec-fetch-site"]);
  const origin = single(headers.origin);
  if (site !== undefined && site !== "same-origin") return true;
  if (origin !== undefined) return !allowedOrigins.includes(origin);
  return site === undefined;
}
