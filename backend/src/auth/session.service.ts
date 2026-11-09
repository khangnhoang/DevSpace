import { Inject, Injectable, Logger } from "@nestjs/common";
import { ServerEnv } from "../common/env";
import { SERVER_ENV } from "../common/tokens";
import { SessionCache, type CachedUser } from "./session-cache";
import { precheckToken } from "./token";

export type SessionResult =
  | { kind: "ok"; user: CachedUser }
  | { kind: "unauthorized" }
  // The Auth server could not answer. Never accepted, never cached: the caller gets 503.
  | { kind: "unavailable" };

const AUTH_TIMEOUT_MS = 5000;

// ADR 0008 D6, method A: the access token goes to `GET /auth/v1/user` and the answer is trusted. Refresh stays with
// proxy.ts; the API never refreshes.
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly cache: SessionCache;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    this.cache = new SessionCache(env.sessionCacheTtlMs);
  }

  async verify(
    token: string,
    options: { sensitive: boolean },
  ): Promise<SessionResult> {
    const checked = precheckToken(token, Date.now());
    if (!checked.ok) return { kind: "unauthorized" };

    if (!options.sensitive) {
      const hit = this.cache.get(token);
      if (hit) return { kind: "ok", user: hit };
    }

    let response: Response;
    try {
      response = await fetch(`${this.env.supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: this.env.supabaseAnonKey,
          authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
    } catch {
      this.logger.warn("Auth server unreachable");
      return { kind: "unavailable" };
    }

    if (response.status === 200) {
      const user = await readUser(response);
      if (!user) return { kind: "unavailable" };
      if (!options.sensitive) this.cache.set(token, user, checked.expiresAtMs);
      return { kind: "ok", user };
    }
    // Only a 401 or 403 refuses a token: the Auth server answers 403 for a forged, tampered, signed-out or deleted-user
    // token (`bad_jwt`, `session_not_found`, `user_not_found`). Every other answer (a 400, 404 or 405 from a wrong
    // endpoint, 408, 429, a 5xx) says nothing about the token, so it is 503 and is never cached.
    if (response.status === 401 || response.status === 403) {
      const refusal = await readRefusal(response);
      if (refusal === "unread") {
        // The answer did not arrive whole: the call did not complete, so there is no verdict on the session.
        this.logger.warn("Auth server answer could not be read");
        return { kind: "unavailable" };
      }
      if (refusal === "token") return { kind: "unauthorized" };
      // A refusal that names the API key (and no token code) means the API's own configuration is wrong, and must not
      // sign every user out.
      if (refusal === "api-key") {
        this.logger.warn(
          `Auth server refused the API's own key (${response.status})`,
        );
        return { kind: "unavailable" };
      }
      return { kind: "unauthorized" };
    }
    await response.body?.cancel();
    this.logger.warn(`Auth server answered ${response.status}`);
    return { kind: "unavailable" };
  }
}

// The `error_code` values the Auth server answers for a token or session that it knows is no good (the local stack
// answers these three with a 403; `session_expired` is the same kind). A code in the body decides before any message
// does, because a message can mention an API key for a token problem too.
const TOKEN_CODES = new Set([
  "bad_jwt",
  "session_not_found",
  "session_expired",
  "user_not_found",
]);

type Refusal = "token" | "api-key" | "other" | "unread";

async function readRefusal(response: Response): Promise<Refusal> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return "unread";
  }
  try {
    const body = JSON.parse(text) as { code?: unknown; error_code?: unknown };
    for (const code of [body.error_code, body.code])
      if (typeof code === "string" && TOKEN_CODES.has(code)) return "token";
  } catch {
    // Not JSON: only the message check below applies.
  }
  return /api key/i.test(text) ? "api-key" : "other";
}

async function readUser(response: Response): Promise<CachedUser | undefined> {
  try {
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === "string" && body.id !== ""
      ? { id: body.id }
      : undefined;
  } catch {
    return undefined;
  }
}
