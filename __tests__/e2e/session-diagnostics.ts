import { createClient } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import {
  accessTokenOf,
  checkAccessToken,
  describeSession,
  isRefreshRequest,
  type TokenCheck,
} from "../helpers/e2e-session";
import { authFile, type Actor } from "./accounts";
import type { ServerRecords } from "./fixtures";

// Facts about a saved session for a row whose failure looks like a lost session (QE-P7). It records, without a value:
// the session's age and the access token's remaining lifetime (decoded from the cookie), whether Auth recognises the
// access token before the test uses it, the refreshes the browser sends with their status, the refreshes and token
// checks the server sends with their status, and the auth cookie names. It never refreshes or rotates the session:
// the token check is `getUser(jwt)` on a client that holds no refresh token (QE-U5 G4).
type Cookie = { name: string; value: string };

export type SessionObservation = {
  // Prints one line of the facts so far, so a passing run keeps the evidence too. Names and numbers only.
  log(label: string): Promise<void>;
  // Fails the row at its start, with a message that says so, when Auth does not recognise the saved session.
  requireRecognised(): void;
  // Runs the row's first expectation of a signed-in page. When it fails and the page shows the signed-out header, the
  // error says the session was lost and carries the facts, instead of reporting the missing content.
  explainSignedOut(
    page: Page,
    expectation: () => Promise<unknown>,
  ): Promise<void>;
};

export async function observeSession(
  context: BrowserContext,
  actor: Actor,
  serverRecords: ServerRecords,
): Promise<SessionObservation> {
  const saved = JSON.parse(readFileSync(authFile(actor), "utf8")) as {
    cookies: Cookie[];
  };
  const facts = describeSession(saved.cookies);
  const jwt = accessTokenOf(saved.cookies);

  let check: TokenCheck = {
    recognised: false,
    status: null,
    code: "no access token in the saved cookies",
  };
  if (jwt) {
    const stack = readTestStack(join(__dirname, "../.."));
    const client = createClient(stack.apiUrl, stack.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    check = await checkAccessToken(client, jwt);
  }

  const browserRefreshes: { status: number; at: string }[] = [];
  context.on("response", (response) => {
    if (isRefreshRequest(response.url()))
      browserRefreshes.push({
        status: response.status(),
        at: new Date().toISOString(),
      });
  });

  const report = async () => {
    const now = (await context.cookies())
      .filter((cookie) => /^sb-.*-auth-token/.test(cookie.name))
      .map((cookie) => cookie.name);
    return JSON.stringify({
      actor,
      saved: facts,
      tokenCheckBeforeTest: check,
      browserRefreshes,
      serverAuthCalls: serverRecords.authCalls(),
      authCookieNamesNow: now,
    });
  };

  return {
    async log(label) {
      console.log(`[session ${label}] ${await report()}`);
    },
    requireRecognised() {
      if (!check.recognised) {
        throw new Error(
          `the saved ${actor} session is not recognised by Auth before the test starts (HTTP ${check.status}, ${check.code}); saved session: ${JSON.stringify(facts)}`,
        );
      }
    },
    async explainSignedOut(page, expectation) {
      try {
        await expectation();
      } catch (original) {
        const signedOut = await page
          .getByRole("link", { name: "Đăng nhập", exact: true })
          .count();
        if (signedOut === 0) throw original;
        throw new Error(
          `the ${actor} is signed out on the page although Auth recognised the saved session before the test; facts: ${await report()}`,
          { cause: original },
        );
      }
    },
  };
}
