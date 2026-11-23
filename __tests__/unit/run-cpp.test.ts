import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONNECTION_LINE,
  RUN_DEADLINE_MS,
  TIMEOUT_LINE,
  WANDBOX_COMPILER,
  WANDBOX_URL,
  runCpp,
} from "@/app/(main)/try_it/_lib/run-cpp";

// `fetch` is the external boundary (Wandbox), so it is faked; the request builder and the interpreter run for real.
function reply(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected token");
      return body;
    },
  } as Response;
}

const SUCCESS = {
  status: "0",
  signal: "",
  compiler_output: "",
  compiler_error: "",
  compiler_message: "",
  program_output: "hi\n",
  program_error: "",
  program_message: "hi\n",
};

// A fetch that never answers on its own and rejects like a browser when its signal aborts.
function hangingFetch() {
  return vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      }),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("runCpp request", () => {
  it("posts only the compiler name and the code, without credentials or referrer", async () => {
    const fetchFn = vi.fn(async () => reply(200, SUCCESS));
    await runCpp("int main() {}", fetchFn, new AbortController().signal);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(WANDBOX_URL);
    expect(url).toBe("https://wandbox.org/api/compile.json");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      compiler: WANDBOX_COMPILER,
      code: "int main() {}",
    });
    expect(WANDBOX_COMPILER).toBe("gcc-13.2.0");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the interpreted answer", async () => {
    await expect(
      runCpp(
        "x",
        async () => reply(200, SUCCESS),
        new AbortController().signal,
      ),
    ).resolves.toEqual({ lines: ["hi"], outcome: "success" });
  });

  it("reads a plain-text 429 refusal as the too-many-runs error", async () => {
    const result = await runCpp(
      "x",
      async () => reply(429, undefined),
      new AbortController().signal,
    );
    expect(result.outcome).toBe("request-error");
    expect("lines" in result && result.lines[0]).toContain("HTTP 429");
  });
});

describe("runCpp ways out", () => {
  it("stops waiting at the deadline, aborts the request and returns the timeout line", async () => {
    vi.useFakeTimers();
    const fetchFn = hangingFetch();
    const pending = runCpp("for(;;){}", fetchFn, new AbortController().signal);

    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MS - 1);
    const signal = fetchFn.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    await expect(pending).resolves.toEqual({
      lines: [TIMEOUT_LINE],
      outcome: "timeout",
    });
  });

  it("returns the timeout line when the deadline passes while the body is read", async () => {
    vi.useFakeTimers();
    let release: () => void = () => {};
    const fetchFn = vi.fn(
      async () =>
        ({
          status: 200,
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              release = () => reject(new DOMException("aborted", "AbortError"));
            }),
        }) as unknown as Response,
    );
    const pending = runCpp("x", fetchFn, new AbortController().signal);

    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MS);
    release();
    await expect(pending).resolves.toEqual({
      lines: [TIMEOUT_LINE],
      outcome: "timeout",
    });
  });

  it("returns the timeout line at the deadline even when the request ignores its signal", async () => {
    vi.useFakeTimers();
    const pending = runCpp(
      "x",
      () => new Promise<Response>(() => {}),
      new AbortController().signal,
    );

    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MS);
    await expect(pending).resolves.toEqual({
      lines: [TIMEOUT_LINE],
      outcome: "timeout",
    });
  });

  it("returns the connection line, without a provider name, when fetch rejects", async () => {
    const result = await runCpp(
      "x",
      async () => {
        throw new TypeError("Failed to fetch");
      },
      new AbortController().signal,
    );
    expect(result).toEqual({
      lines: [CONNECTION_LINE],
      outcome: "connection-error",
    });
    expect(CONNECTION_LINE).not.toMatch(/wandbox/i);
  });

  it("returns aborted, with no line, when the caller aborts", async () => {
    const caller = new AbortController();
    const fetchFn = hangingFetch();
    const pending = runCpp("x", fetchFn, caller.signal);

    caller.abort();
    expect((fetchFn.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    await expect(pending).resolves.toEqual({ outcome: "aborted" });
  });

  it("returns aborted even when an answer arrives after the caller aborted", async () => {
    const caller = new AbortController();
    let answer: (value: Response) => void = () => {};
    const pending = runCpp(
      "x",
      () => new Promise<Response>((resolve) => (answer = resolve)),
      caller.signal,
    );

    caller.abort();
    answer(reply(200, SUCCESS));
    await expect(pending).resolves.toEqual({ outcome: "aborted" });
  });
});
