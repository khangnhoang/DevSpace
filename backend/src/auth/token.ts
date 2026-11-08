import { createHash } from "node:crypto";

// A session token comes from `Authorization: Bearer` or from the Supabase auth cookie that the browser sends through
// the rewrite (`sb-<ref>-auth-token`, chunked as `.0`, `.1`, and prefixed `base64-` by @supabase/ssr). Nothing here
// trusts the token: the pre-check below only refuses, and acceptance is the Auth server's answer (ADR 0008 D6).
const COOKIE_NAME = /^sb-.+-auth-token(?:\.(\d+))?$/;
const MAX_TOKEN_LENGTH = 8192;

type Headers = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function decodeCookieSession(raw: string): string | undefined {
  try {
    const value = decodeURIComponent(raw);
    const json = value.startsWith("base64-")
      ? Buffer.from(value.slice(7), "base64url").toString("utf8")
      : value;
    const session = JSON.parse(json) as { access_token?: unknown };
    return typeof session.access_token === "string"
      ? session.access_token
      : undefined;
  } catch {
    return undefined;
  }
}

export function extractToken(headers: Headers): string | undefined {
  const authorization = single(headers.authorization);
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
    return match?.[1];
  }
  const cookie = single(headers.cookie);
  if (!cookie) return undefined;
  const chunks = new Map<number, string>();
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const found = COOKIE_NAME.exec(part.slice(0, separator).trim());
    if (found) {
      chunks.set(Number(found[1] ?? 0), part.slice(separator + 1).trim());
    }
  }
  if (chunks.size === 0) return undefined;
  const joined = [...chunks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value)
    .join("");
  return decodeCookieSession(joined);
}

export type TokenCheck = { ok: false } | { ok: true; expiresAtMs: number };

function decodeSegment(segment: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    );
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

// Refusal only: a token that is not a three-part JWT, names no algorithm or `none`, has no signature, or is past its
// `exp` never reaches the network. A token that passes is still unverified; the Auth server decides.
export function precheckToken(token: string, nowMs: number): TokenCheck {
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part === "")) {
    return { ok: false };
  }
  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);
  if (!header || !payload) return { ok: false };
  if (typeof header.alg !== "string" || header.alg.toLowerCase() === "none") {
    return { ok: false };
  }
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return { ok: false };
  }
  const expiresAtMs = payload.exp * 1000;
  if (expiresAtMs <= nowMs) return { ok: false };
  return { ok: true, expiresAtMs };
}

export function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
