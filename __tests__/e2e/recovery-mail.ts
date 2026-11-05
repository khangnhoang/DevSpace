import { expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { join } from "node:path";
import { E2E_ORIGIN } from "../helpers/e2e-env";
import {
  assertMailReady,
  createDocker,
} from "../../scripts/test-stack/docker.mjs";
import { mailRequest } from "../../scripts/test-stack/mail.mjs";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import {
  sharedRunMarker,
  withFixtureScope,
} from "../helpers/fixture-ownership";
import { assertOwnedAuthEmail } from "./service-role";

type Message = { ID: string; To: { Address: string }[] };
const reserved = new Set<string>();
const delay = () => new Promise((resolve) => setTimeout(resolve, 100));

// Only this out-of-band helper sees mail bodies/links; recovery tests disable traces,
// screenshots and video so the PKCE URL and password cannot enter retained artifacts.
export async function withRecoveryMail<T>(
  email: string,
  body: (mail: {
    link(type?: "recovery" | "magiclink"): Promise<string>;
  }) => Promise<T>,
) {
  requireActiveRun({ command: "npm run test:e2e" });
  assertMailReady(createDocker());
  assertOwnedAuthEmail(email);
  if (reserved.has(email))
    throw new Error("Recovery recipient is already acquired");
  const run = sharedRunMarker();
  async function messages(): Promise<Message[]> {
    const result = await mailRequest(
      `/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1000`,
    );
    const matches: Message[] = result.messages ?? [];
    if (
      matches.length !== result.total ||
      matches.some(
        (item) => !item.To.length || item.To.some((to) => to.Address !== email),
      )
    ) {
      throw new Error("Ambiguous recovery mailbox ownership");
    }
    return matches;
  }
  if ((await messages()).length) {
    run.mark("Recovery mailbox recipient occupied before reservation");
    throw new Error(
      "Recovery recipient has stale mail; nothing acquired or deleted",
    );
  }
  const stack = readTestStack(join(__dirname, "../.."));
  reserved.add(email);
  return withFixtureScope(
    {
      cleanup: async () => {
        if (!reserved.has(email)) return;
        try {
          const owned = await messages();
          if (owned.length)
            await mailRequest("/api/v1/messages", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ IDs: owned.map((item) => item.ID) }),
            });
          if ((await messages()).length)
            throw new Error("Owned recovery mail remains");
          reserved.delete(email);
        } catch {
          run.mark("Recovery mailbox cleanup unresolved");
          throw new Error(
            "Recovery mailbox cleanup failed; recipient ownership retained",
          );
        }
      },
    },
    () =>
      body({
        link: async (type = "recovery") => {
          let found: Message[] = [];
          for (let attempt = 0; attempt < 100; attempt++) {
            found = await messages();
            if (found.length) break;
            await delay();
          }
          if (found.length !== 1)
            throw new Error("Expected exactly one new owned recovery message");
          const message = await mailRequest(`/api/v1/message/${found[0].ID}`);
          const urls =
            String(message.HTML).match(/https?:\/\/[^\s"<>]+/g) ?? [];
          const links = urls
            .map((value) => URL.parse(value.replaceAll("&amp;", "&")))
            .filter((url) => url !== null)
            .filter(
              (url) =>
                url.origin === stack.apiUrl &&
                url.pathname === "/auth/v1/verify" &&
                url.searchParams.get("type") === type,
            );
          if (links.length !== 1)
            throw new Error(
              "Mail has no unique recovery link at the verified test Auth origin",
            );
          const target = URL.parse(
            links[0].searchParams.get("redirect_to") ?? "",
          );
          if (
            target?.origin !== E2E_ORIGIN ||
            target.pathname !== "/auth/callback" ||
            target.searchParams.get("next") !== "/auth/reset-password"
          )
            throw new Error("Recovery callback target mismatch");
          return links[0].href;
        },
      }),
  );
}

export async function fillSensitiveInput(input: Locator, value: string) {
  try {
    // Playwright logs fill values and puts keyboard.insertText values in its
    // HTML report. Chromium can insert text in the focused field from evaluate.
    await expect
      .poll(() => input.isEditable({ timeout: 1000 }).catch(() => false), {
        message: "sensitive input is editable",
      })
      .toBe(true);
    await input.click();
    await input.press("ControlOrMeta+a");
    const inserted = await input.evaluate(
      (node, text) =>
        document.activeElement === node &&
        document.execCommand("insertText", false, text),
      value,
    );
    if (!inserted) throw new Error();
  } catch {
    throw new Error("Could not fill the sensitive input");
  }
}

// Locator matchers can attach a snapshot of the whole page on failure.
export function expectRecoveryVisible(locator: Locator) {
  return expect
    .poll(() => locator.isVisible(), { message: `${locator} is visible` })
    .toBe(true);
}

export async function expectSensitiveValue(input: Locator, value: string) {
  await expect
    .poll(
      () =>
        input
          .evaluate(
            (node, expected) => (node as HTMLInputElement).value === expected,
            value,
            { timeout: 1000 },
          )
          .catch(() => false),
      { message: "sensitive input retains its expected value" },
    )
    .toBe(true);
}

export async function expectRecoveryRoute(page: Page, path: string) {
  await expect
    .poll(
      () => {
        const url = URL.parse(page.url());
        return (
          url?.origin === E2E_ORIGIN &&
          url.pathname === path &&
          (path === "/auth/error" || (!url.search && !url.hash))
        );
      },
      { message: `recovery reaches the local ${path} route` },
    )
    .toBe(true);
}

export async function requestRecovery(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await fillSensitiveInput(page.getByPlaceholder("Email của bạn..."), email);
  const [sent] = await Promise.all([
    page.waitForResponse(
      (response) =>
        URL.parse(response.url())?.pathname === "/auth/v1/recover" &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Gửi yêu cầu" }).click(),
  ]);
  if (sent.status() !== 200)
    throw new Error("Recovery request failed; body suppressed");
}

export async function requestMagicLink(page: Page, email: string) {
  requireActiveRun({ command: "npm run test:e2e" });
  assertOwnedAuthEmail(email);
  const stack = readTestStack(join(__dirname, "../.."));
  // Use the real PKCE client and transfer only its verifier cookies to the browser
  // because the product has no magic-link sign-in form.
  const cookies = new Map<string, string>();
  const client = createServerClient(stack.apiUrl, stack.anonKey, {
    cookies: {
      getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
      setAll: (entries) => {
        for (const { name, value } of entries) cookies.set(name, value);
      },
    },
  });
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${E2E_ORIGIN}/auth/callback?next=/auth/reset-password`,
    },
  });
  if (error || !cookies.size)
    throw new Error("Could not request a real non-recovery PKCE link");
  await page
    .context()
    .addCookies(
      Array.from(cookies, ([name, value]) => ({
        name,
        value,
        url: E2E_ORIGIN,
      })),
    )
    .catch(() => {
      throw new Error("Could not transfer the local PKCE verifier cookie");
    });
}

export async function followAuthMail(page: Page, link: string) {
  // Keep the live link out of Playwright navigation logs and failure messages.
  await page
    .evaluate((target) => {
      window.location.href = target;
    }, link)
    .catch(() => {
      throw new Error("Could not follow the verified local mail link");
    });
}

export async function verifiedSessionClaims(page: Page, userId: string) {
  const stack = readTestStack(join(__dirname, "../.."));
  const cookies = await page.context().cookies();
  const key = `sb-${new URL(stack.apiUrl).hostname.split(".")[0]}-auth-token`;
  const chunks = cookies
    .filter(
      (cookie) => cookie.name === key || cookie.name.startsWith(`${key}.`),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const encoded = chunks.map((cookie) => cookie.value).join("");
  if (!encoded.startsWith("base64-"))
    throw new Error("Auth session cookie missing");
  let accessToken: unknown;
  try {
    accessToken = JSON.parse(
      Buffer.from(encoded.slice(7), "base64url").toString(),
    ).access_token;
  } catch {
    throw new Error("Auth session cookie could not be decoded");
  }
  if (typeof accessToken !== "string" || !accessToken)
    throw new Error("Auth session access token missing");
  const client = createClient(stack.apiUrl, stack.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.getClaims(accessToken);
  if (error || data?.claims.sub !== userId || !data.claims.session_id)
    throw new Error("Verified session/subject mismatch");
  return data.claims;
}

export async function verifiedRecovery(page: Page, userId: string) {
  const claims = await verifiedSessionClaims(page, userId);
  if (
    !claims.amr?.some(
      (entry) => typeof entry !== "string" && entry.method === "recovery",
    )
  )
    throw new Error("Verified recovery method missing");
  return claims.session_id;
}

export async function acceptsFixturePassword(email: string, password: string) {
  requireActiveRun({ command: "npm run test:e2e" });
  assertOwnedAuthEmail(email);
  const stack = readTestStack(join(__dirname, "../.."));
  const client = createClient(stack.apiUrl, stack.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error?.code === "invalid_credentials") return false;
  if (error || !data.session)
    throw new Error("Fixture password probe could not complete");
  return true;
}
