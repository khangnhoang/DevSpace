// What the e2e diagnostics may say about a saved session (QE-P7, QE-U5 G4). Everything here reads the cookies
// locally and returns names and numbers only: a token, a refresh token or a cookie value never leaves these functions
// except `accessTokenOf`, whose result goes straight to `getUser(jwt)` and is never printed.

type Cookie = { name: string; value: string };

export type SessionFacts = {
  cookieNames: string[];
  // Seconds since the epoch, from the access token's own claims; null when the cookie holds no readable token.
  issuedAt: number | null;
  expiresAt: number | null;
  lifetimeSeconds: number | null;
  ageSeconds: number | null;
  remainingSeconds: number | null;
};

const AUTH_COOKIE = /^sb-.*-auth-token(?:\.(\d+))?$/;

function sessionJson(cookies: Cookie[]): Record<string, unknown> | null {
  const chunks = cookies
    .map((cookie) => ({
      match: AUTH_COOKIE.exec(cookie.name),
      value: cookie.value,
    }))
    .filter((entry) => entry.match)
    .sort((a, b) => Number(a.match![1] ?? -1) - Number(b.match![1] ?? -1));
  if (!chunks.length) return null;
  let raw = chunks.map((chunk) => chunk.value).join("");
  try {
    // @supabase/ssr stores "base64-" + base64url(JSON); older versions stored the percent-encoded JSON itself.
    raw = raw.startsWith("base64-")
      ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
      : decodeURIComponent(raw);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The access token of a saved session, for `getUser(jwt)` only. Never print it. */
export function accessTokenOf(cookies: Cookie[]): string | null {
  const token = sessionJson(cookies)?.access_token;
  return typeof token === "string" ? token : null;
}

function claims(jwt: string): { iat?: number; exp?: number } | null {
  try {
    return JSON.parse(
      Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }
}

export function describeSession(
  cookies: Cookie[],
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionFacts {
  const cookieNames = cookies
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .map((cookie) => cookie.name);
  const token = accessTokenOf(cookies);
  const payload = token ? claims(token) : null;
  const issuedAt = typeof payload?.iat === "number" ? payload.iat : null;
  const expiresAt = typeof payload?.exp === "number" ? payload.exp : null;
  return {
    cookieNames,
    issuedAt,
    expiresAt,
    lifetimeSeconds:
      issuedAt !== null && expiresAt !== null ? expiresAt - issuedAt : null,
    ageSeconds: issuedAt !== null ? nowSeconds - issuedAt : null,
    remainingSeconds: expiresAt !== null ? expiresAt - nowSeconds : null,
  };
}

export function isRefreshRequest(url: string): boolean {
  const parsed = URL.parse(url);
  return (
    parsed?.pathname.endsWith("/auth/v1/token") === true &&
    parsed.searchParams.get("grant_type") === "refresh_token"
  );
}

export type TokenCheck = {
  recognised: boolean;
  status: number | null;
  code: string | null;
};

// `getUser(jwt)` validates the access token against Auth and holds no refresh token, so the check cannot refresh or
// rotate the session it observes.
export async function checkAccessToken(
  client: {
    auth: {
      getUser(
        jwt: string,
      ): Promise<{ error: { status?: number; code?: string } | null }>;
    };
  },
  jwt: string,
): Promise<TokenCheck> {
  const { error } = await client.auth.getUser(jwt);
  return error
    ? {
        recognised: false,
        status: error.status ?? null,
        code: error.code ?? null,
      }
    : { recognised: true, status: 200, code: null };
}
