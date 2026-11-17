import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TryItPage from "@/app/(main)/try_it/page";
import { RUN_DEADLINE_MS } from "@/app/(main)/try_it/_lib/run-cpp";

// Only modules outside the page are replaced: the Monaco editor (a textarea that still sets the code), the search
// params, the toast and the global fetch (Wandbox). The page's handler and the `_lib/` helpers run for real.
const { toast, params } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  params: { current: new URLSearchParams("lang=cpp") },
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string | undefined) => void;
  }) => (
    <textarea
      aria-label="editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  loader: { config: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => params.current }));
vi.mock("sonner", () => ({ toast }));

interface HeldCall {
  init: RequestInit;
  resolve: (status: number, body: unknown) => void;
  reject: (error: unknown) => void;
}

// Each call stays pending until the test settles it; it ignores its signal, like a late answer would.
function holdFetch() {
  const calls: HeldCall[] = [];
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({
          init,
          resolve: (status, body) =>
            resolve({
              status,
              ok: status >= 200 && status < 300,
              json: async () => {
                if (body === undefined) throw new SyntaxError("not JSON");
                return body;
              },
            } as Response),
          reject,
        });
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function wandbox(fields: Record<string, string>) {
  return {
    status: "0",
    signal: "",
    compiler_output: "",
    compiler_error: "",
    compiler_message: "",
    program_output: "",
    program_error: "",
    program_message: "",
    ...fields,
  };
}

const runButton = () =>
  screen.getByRole("button", { name: /Chạy Code|Running/ });
const tab = (name: string) => screen.getByRole("button", { name });
const consoleText = () =>
  screen.queryByText("Terminal / Console")?.parentElement?.textContent ?? "";

async function settle(action: () => void) {
  await act(async () => {
    action();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  params.current = new URLSearchParams("lang=cpp");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Try It C++ run, while waiting", () => {
  it("disables the button and shows Compiling... while the answer is pending", async () => {
    const { fetchMock } = holdFetch();
    const user = userEvent.setup();
    render(<TryItPage />);

    await user.click(runButton());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runButton()).toBeDisabled();
    expect(screen.getByText("Compiling...")).toBeInTheDocument();
  });

  it("sends the code in the editor", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);

    fireEvent.change(screen.getByLabelText("editor"), {
      target: { value: "int main() { return 7; }" },
    });
    fireEvent.click(runButton());

    expect(JSON.parse(calls[0].init.body as string).code).toBe(
      "int main() { return 7; }",
    );
  });

  it("starts one request for two activations before the next render", async () => {
    const { fetchMock } = holdFetch();
    render(<TryItPage />);
    const button = runButton();

    await act(async () => {
      button.click();
      button.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Try It C++ run, each way out frees the button", () => {
  it("shows program output as text, never as markup", async () => {
    const { calls } = holdFetch();
    const { container } = render(<TryItPage />);
    fireEvent.click(runButton());

    await settle(() =>
      calls[0].resolve(200, wandbox({ program_output: "<b>bold</b>\n" })),
    );

    expect(screen.getByText("<b>bold</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });
  it("shows the output and the success toast", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());

    await settle(() =>
      calls[0].resolve(200, wandbox({ program_output: "Hello DevSpace\n" })),
    );

    expect(runButton()).toBeEnabled();
    expect(consoleText()).toContain("Hello DevSpace");
    expect(toast.success).toHaveBeenCalledWith("Chạy thành công!");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the compiler text, the closing line and the run-error toast for a failed compile", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());

    await settle(() =>
      calls[0].resolve(
        200,
        wandbox({ status: "1", compiler_error: "prog.cc:1:1: error: boom\n" }),
      ),
    );

    expect(runButton()).toBeEnabled();
    expect(screen.getByText("prog.cc:1:1: error: boom")).toBeInTheDocument();
    expect(
      screen.getByText("Biên dịch hoặc chạy không thành công (mã thoát 1)."),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Có lỗi biên dịch hoặc runtime!");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the wait message and the server-error toast for HTTP 429", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());

    await settle(() => calls[0].resolve(429, undefined));

    expect(runButton()).toBeEnabled();
    expect(consoleText()).toContain("đợi vài phút");
    expect(consoleText()).toContain("HTTP 429");
    expect(toast.error).toHaveBeenCalledWith(
      "Server biên dịch không chạy được mã!",
    );
  });

  it("shows the connection error and its toast when fetch rejects", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());

    await settle(() => calls[0].reject(new TypeError("Failed to fetch")));

    expect(runButton()).toBeEnabled();
    expect(
      screen.getByText("Lỗi: Không thể kết nối đến server biên dịch."),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Lỗi kết nối Server biên dịch!");
  });

  it("stops waiting at the deadline, aborts the request and shows the endless-loop hint", async () => {
    vi.useFakeTimers();
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());
    const signal = calls[0].init.signal as AbortSignal;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MS);
    });

    expect(signal.aborted).toBe(true);
    expect(runButton()).toBeEnabled();
    expect(consoleText()).toContain("vòng lặp vô hạn");
    expect(toast.error).toHaveBeenCalledWith("Chương trình chạy quá lâu!");
  });
});

describe("Try It C++ run, only the current run changes the page", () => {
  it("aborts the request on a tab switch and frees the button at once", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());
    const signal = calls[0].init.signal as AbortSignal;

    fireEvent.click(tab("HTML"));

    expect(signal.aborted).toBe(true);
    expect(runButton()).toBeEnabled();
  });

  it("writes nothing when the abandoned run ends after the visitor returns to C++", async () => {
    const { calls } = holdFetch();
    render(<TryItPage />);
    fireEvent.click(runButton());
    fireEvent.click(tab("HTML"));
    fireEvent.click(tab("C++"));

    await settle(() =>
      calls[0].resolve(200, wandbox({ program_output: "late\n" })),
    );

    expect(consoleText()).not.toContain("late");
    expect(
      screen.getByText('Nhấn "Chạy Code" để xem kết quả...'),
    ).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([
    [
      "answers",
      (call: HeldCall) => call.resolve(200, wandbox({ program_output: "A\n" })),
    ],
    [
      "fails",
      (call: HeldCall) => call.reject(new TypeError("Failed to fetch")),
    ],
  ])(
    "keeps a newer run waiting and its console untouched when the abandoned run %s",
    async (_case, endRunA) => {
      const { calls, fetchMock } = holdFetch();
      render(<TryItPage />);
      fireEvent.click(runButton());
      fireEvent.click(tab("HTML"));
      fireEvent.click(tab("C++"));
      fireEvent.click(runButton());
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await settle(() => endRunA(calls[0]));

      expect(runButton()).toBeDisabled();
      expect(screen.getByText("Compiling...")).toBeInTheDocument();
      expect(screen.queryByText("A")).toBeNull();
      expect(consoleText()).not.toContain("Lỗi");
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();

      await settle(() =>
        calls[1].resolve(200, wandbox({ program_output: "run B\n" })),
      );

      expect(runButton()).toBeEnabled();
      expect(screen.getByText("run B")).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledTimes(1);
    },
  );

  it("aborts a pending request when the page unmounts", () => {
    const { calls } = holdFetch();
    const { unmount } = render(<TryItPage />);
    fireEvent.click(runButton());
    const signal = calls[0].init.signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("keeps a run started after React's development remount of effects alive until it answers", async () => {
    const { calls } = holdFetch();
    render(
      <StrictMode>
        <TryItPage />
      </StrictMode>,
    );
    fireEvent.click(runButton());
    const signal = calls[0].init.signal as AbortSignal;

    expect(signal.aborted).toBe(false);
    await settle(() =>
      calls[0].resolve(200, wandbox({ program_output: "ok\n" })),
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
