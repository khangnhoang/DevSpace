import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  FixtureScope,
  serviceRoleClients,
  sharedRunMarker,
} from "./fixture-ownership";
import type { ApiStack } from "./api-process";

const OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export type MintedSession = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  // The value of the Supabase auth cookie a browser would send through the rewrite.
  cookie: string;
  // Seconds since the epoch.
  expiresAt: number;
};

// Sessions for the API tests. Users are created and sessions are minted through the local Admin API (a magic-link
// token exchanged at /verify), so no password is typed or stored. Every user belongs to the scope and is deleted by
// `cleanup()` (plan G8).
export function apiSessions(stack: ApiStack) {
  const make = (fetchWith: typeof fetch): SupabaseClient =>
    createClient(stack.apiUrl, stack.serviceRoleKey, {
      ...OPTIONS,
      global: { fetch: fetchWith },
    });
  const { fixtures, cleanup } = serviceRoleClients(make, sharedRunMarker);
  const scope = new FixtureScope(cleanup, stack.dbUrl);
  const anon = createClient(stack.apiUrl, stack.anonKey, OPTIONS);

  async function mint(label: string): Promise<MintedSession> {
    const email = `api-${label}-${scope.tag}@devspace.test`;
    await scope.reserveAuth(email);
    const created = await fixtures.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error(`createUser failed: ${created.error?.message}`);
    const link = await fixtures.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const hashed = link.data?.properties?.hashed_token;
    if (link.error || !hashed)
      throw new Error(`generateLink failed: ${link.error?.message}`);
    const verified = await anon.auth.verifyOtp({
      token_hash: hashed,
      type: "magiclink",
    });
    const session = verified.data.session;
    if (verified.error || !session)
      throw new Error(`verifyOtp failed: ${verified.error?.message}`);
    return {
      userId: created.data.user.id,
      email,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      cookie: authCookie(session),
      expiresAt: session.expires_at ?? 0,
    };
  }

  return {
    scope,
    mint,
    // Ends the session at the Auth server (the token then fails /auth/v1/user).
    async signOut(session: MintedSession) {
      const response = await fetch(`${stack.apiUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: stack.anonKey,
          authorization: `Bearer ${session.accessToken}`,
        },
      });
      if (!response.ok) throw new Error(`logout answered ${response.status}`);
    },
    async deleteUser(session: MintedSession) {
      const result = await fixtures.auth.admin.deleteUser(session.userId);
      if (result.error) throw new Error(result.error.message);
    },
    cleanup: () => scope.cleanup(),
  };
}

// The cookie @supabase/ssr writes: `sb-<ref>-auth-token=base64-<base64url of the session JSON>`.
export function authCookie(session: unknown, name = "sb-127-auth-token") {
  const value = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${name}=base64-${value}`;
}

export function bearer(session: Pick<MintedSession, "accessToken">) {
  return { authorization: `Bearer ${session.accessToken}` };
}

// A structurally valid JWT that the Auth server never signed. `exp` is seconds since the epoch.
export function forgedToken(options: {
  alg?: string;
  exp: number;
  signature?: string;
  sub?: string;
}) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [
    encode({ alg: options.alg ?? "HS256", typ: "JWT" }),
    encode({
      sub: options.sub ?? "00000000-0000-0000-0000-000000000000",
      role: "authenticated",
      aud: "authenticated",
      exp: options.exp,
    }),
    options.signature ?? "c2lnbmF0dXJl",
  ].join(".");
}
