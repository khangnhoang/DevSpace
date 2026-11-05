import { TEST_PORTS } from "./config.mjs";
import { assertMailReady, createDocker } from "./docker.mjs";

const origin = `http://127.0.0.1:${TEST_PORTS.smtp}`;
export async function mailRequest(path, options = {}) {
  if (
    !/^\/api\/v1\/(?:messages|search|message\/[a-zA-Z0-9-]+)(?:\?|$)/.test(path)
  )
    throw new Error("Unrecognized test mailbox operation");
  const response = await fetch(`${origin}${path}`, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Test mailbox HTTP ${response.status}; body suppressed`);
  const body = await response.text();
  // Mailpit acknowledges DELETE with plain text on some versions. Absence is verified by the caller's search.
  if (options.method === "DELETE") return null;
  try {
    return body ? JSON.parse(body) : null;
  } catch {
    throw new Error("Invalid test mailbox JSON; body suppressed");
  }
}

export async function assertTestMailboxEmpty(docker = createDocker()) {
  assertMailReady(docker);
  const messages = await mailRequest("/api/v1/messages?limit=1");
  if (messages.total !== 0)
    throw new Error(
      "Test mailbox contains unowned or late mail; stop the test stack before retrying. No messages were deleted.",
    );
}
