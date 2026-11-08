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
    await response.body?.cancel();
    // A refused token (bad signature, signed-out session, deleted user) is a 4xx. Rate limiting and server errors say
    // nothing about the token, so they must not read as a refusal that a client would treat as "signed out".
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408 &&
      response.status !== 429
    ) {
      return { kind: "unauthorized" };
    }
    this.logger.warn(`Auth server answered ${response.status}`);
    return { kind: "unavailable" };
  }
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
