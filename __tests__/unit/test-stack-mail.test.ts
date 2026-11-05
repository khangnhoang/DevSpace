import { afterEach, expect, it, vi } from "vitest";
import { mailRequest } from "../../scripts/test-stack/mail.mjs";

afterEach(() => vi.unstubAllGlobals());

it("accepts Mailpit's plain-text deletion acknowledgement without parsing mail content", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response("Deleted", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    mailRequest("/api/v1/messages", { method: "DELETE" }),
  ).resolves.toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    "http://127.0.0.1:55324/api/v1/messages",
    expect.objectContaining({ method: "DELETE", redirect: "error" }),
  );
});

it("reads the JSON response of a mailbox search", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ total: 0, messages: [] })),
  );
  await expect(
    mailRequest("/api/v1/search?query=to%3Afixture%40devspace.test"),
  ).resolves.toEqual({ total: 0, messages: [] });
});

it("refuses an unrecognized operation before making a request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(mailRequest("https://example.com/messages")).rejects.toThrow(
    /Unrecognized/,
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("reports a failed HTTP status without exposing its body", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response("sensitive mail body", { status: 503 })),
  );
  await expect(mailRequest("/api/v1/messages")).rejects.toThrow(
    "Test mailbox HTTP 503; body suppressed",
  );
});
