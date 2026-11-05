import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";

const { exchange, createClient } = vi.hoisted(() => ({
  exchange: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase.server", () => ({
  createSupabaseServerClient: createClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
  exchange.mockResolvedValue({ error: null });
  createClient.mockResolvedValue({
    auth: { exchangeCodeForSession: exchange },
  });
});

it.each(["/", "/auth/reset-password"])(
  "exchanges the real input code and returns a relative allowlisted path %s",
  async (next) => {
    const input = `http://127.0.0.1:3100/auth/callback?code=test-code&next=${encodeURIComponent(next)}`;
    const request = new NextRequest(input, {
      headers: { Host: "evil.example", "x-forwarded-host": "evil.example" },
    });
    expect(request.nextUrl.origin).toBe("http://localhost:3100");
    const response = await GET(request);
    expect(exchange).toHaveBeenCalledExactlyOnceWith("test-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(next);
    expect(new URL(response.headers.get("location")!, input).origin).toBe(
      "http://127.0.0.1:3100",
    );
  },
);

it.each([
  "https://evil.example",
  "//evil.example",
  "/admin",
  "/auth/reset-password?x=1",
  "javascript:alert(1)",
])("keeps hostile next %s on the same origin", async (next) => {
  const response = await GET(
    new NextRequest(
      `http://127.0.0.1:3100/auth/callback?code=test-code&next=${encodeURIComponent(next)}`,
    ),
  );
  expect(response.headers.get("location")).toBe("/");
  expect(exchange).toHaveBeenCalledOnce();
});

it.each([
  "",
  "?code=test-code&error=denied",
  "?code=test-code&error_description=expired",
])(
  "rejects protocol failure %s without creating an Auth client",
  async (query) => {
    const response = await GET(
      new NextRequest(`http://127.0.0.1:3100/auth/callback${query}`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/auth/error");
    expect(createClient).not.toHaveBeenCalled();
  },
);

it("does not accept an existing session as proof when code exchange fails", async () => {
  exchange.mockResolvedValue({ error: { code: "flow_state_not_found" } });
  const response = await GET(
    new NextRequest(
      "http://127.0.0.1:3100/auth/callback?code=used-code&next=/auth/reset-password",
    ),
  );
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("/auth/error");
});
