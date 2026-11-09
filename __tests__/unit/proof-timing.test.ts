// Test plan
// Goal: the Server-Timing value of the temporary routes (plan M1) is a span that starts in the middleware, before every
//   guard, and ends when the handler has finished, and it appears only on an answer from a handler.
// Layer: unit. The middleware and the interceptor run on stand-in request, response and handler objects; nest's own
//   wiring is covered by the api row of __tests__/api/proof-gate.test.ts.
// Subject: backend/src/proof/proof-timing.ts (removed by PR 2).
// Invariants: no header without a stamp or after the headers went out; the header carries a duration only.
import { delay, lastValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";
import {
  ProofTimingInterceptor,
  ProofTimingMiddleware,
} from "../../backend/src/proof/proof-timing";

type Fake = Record<string, unknown>;

function exchange(headersSent = false) {
  const headers = new Map<string, string>();
  const request: Fake = {};
  const response = {
    headersSent,
    setHeader: (name: string, value: string) => headers.set(name, value),
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
  return { headers, request, context };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const durOf = (value: string | undefined) =>
  Number(/^api;dur=(\d+(?:\.\d+)?)$/.exec(value ?? "")?.[1]);

describe("proof Server-Timing", () => {
  it("measures from the middleware to the end of the handler, so the time before the handler counts", async () => {
    const { headers, request, context } = exchange();
    new ProofTimingMiddleware().use(request as never, {} as never, () => {});
    // Time spent by the guards, before the interceptor sees the request.
    await sleep(80);
    await lastValueFrom(
      new ProofTimingInterceptor().intercept(context as never, {
        handle: () => of("done").pipe(delay(60)),
      }),
    );
    const dur = durOf(headers.get("Server-Timing"));
    expect(dur, headers.get("Server-Timing")).toBeGreaterThanOrEqual(135);
  });

  it("sets the header only after the handler has finished", async () => {
    const { headers, request, context } = exchange();
    new ProofTimingMiddleware().use(request as never, {} as never, () => {});
    const pending = lastValueFrom(
      new ProofTimingInterceptor().intercept(context as never, {
        handle: () => of("done").pipe(delay(100)),
      }),
    );
    await sleep(30);
    expect(headers.has("Server-Timing"), "handler still running").toBe(false);
    await pending;
    expect(headers.has("Server-Timing")).toBe(true);
  });

  it("sets nothing for a request the middleware did not stamp, or when the headers went out", async () => {
    const unstamped = exchange();
    await lastValueFrom(
      new ProofTimingInterceptor().intercept(unstamped.context as never, {
        handle: () => of(1),
      }),
    );
    expect(unstamped.headers.size).toBe(0);

    const sent = exchange(true);
    new ProofTimingMiddleware().use(
      sent.request as never,
      {} as never,
      () => {},
    );
    await lastValueFrom(
      new ProofTimingInterceptor().intercept(sent.context as never, {
        handle: () => of(1),
      }),
    );
    expect(sent.headers.size).toBe(0);
  });
});
