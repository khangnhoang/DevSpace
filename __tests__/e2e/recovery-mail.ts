import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";
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
  body: (mail: { link(): Promise<string> }) => Promise<T>,
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
  reserved.add(email);
  const stack = readTestStack(join(__dirname, "../.."));
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
        link: async () => {
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
            .map((value) => new URL(value.replaceAll("&amp;", "&")))
            .filter(
              (url) =>
                url.origin === stack.apiUrl &&
                url.pathname === "/auth/v1/verify" &&
                url.searchParams.get("type") === "recovery",
            );
          if (links.length !== 1)
            throw new Error(
              "Mail has no unique recovery link at the verified test Auth origin",
            );
          const target = new URL(
            links[0].searchParams.get("redirect_to") ?? "",
          );
          if (
            target.origin !== "http://127.0.0.1:3100" ||
            target.pathname !== "/auth/callback" ||
            target.searchParams.get("next") !== "/auth/reset-password"
          )
            throw new Error("Recovery callback target mismatch");
          return links[0].href;
        },
      }),
  );
}

export async function requestRecovery(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await page.getByPlaceholder("Email của bạn...").fill(email);
  const sent = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/auth/v1/recover" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  if ((await sent).status() !== 200)
    throw new Error("Recovery request failed; body suppressed");
}

export async function verifiedRecovery(page: Page, userId: string) {
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
    throw new Error("Recovery session cookie missing");
  const session = JSON.parse(
    Buffer.from(encoded.slice(7), "base64url").toString(),
  );
  const client = createClient(stack.apiUrl, stack.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.getClaims(session.access_token);
  if (
    error ||
    data?.claims.sub !== userId ||
    !data.claims.amr?.some(
      (entry) => typeof entry !== "string" && entry.method === "recovery",
    )
  )
    throw new Error("Verified recovery claims/subject mismatch");
}
