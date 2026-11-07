import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Quiz, { type QuizQuestion } from "@/app/components/Quiz";

// Only modules outside the component are replaced (progress write, router, toast); the answer check and the
// component's own handlers run for real.
const { saveUserProgress, refresh, push } = vi.hoisted(() => ({
  saveUserProgress: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  saveUserProgress,
  supabase: { auth: { getUser: vi.fn() } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, back: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const questions: QuizQuestion[] = [
  {
    id: 1,
    question: "Thẻ nào tạo tiêu đề?",
    options: ["h1", "p"],
    correctAnswer: "a",
  },
  {
    id: 2,
    question: "Thẻ nào tạo đoạn văn?",
    options: ["h1", "p"],
    correctAnswer: "b",
  },
];

beforeEach(() => {
  saveUserProgress.mockReset().mockResolvedValue(undefined);
  refresh.mockReset();
  push.mockReset();
});

async function answerCorrectly(
  user: ReturnType<typeof userEvent.setup>,
  question: string,
  option: string,
  next: string,
) {
  expect(screen.getByText(question)).toBeInTheDocument();
  await user.click(screen.getByText(option));
  await user.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await user.click(screen.getByRole("button", { name: next }));
}

describe("Quiz completion", () => {
  it("shows the completion screen with the next-lesson note after the last correct answer", async () => {
    const user = userEvent.setup();
    render(
      <Quiz
        questions={questions}
        lessonId={5}
        userId="u1"
        nextLessonPath="/learn/c/next"
      />,
    );

    await answerCorrectly(user, "Thẻ nào tạo tiêu đề?", "h1", "Câu tiếp theo");
    expect(screen.queryByText("Xuất sắc!")).not.toBeInTheDocument();
    await answerCorrectly(
      user,
      "Thẻ nào tạo đoạn văn?",
      "p",
      "Hoàn thành bài học",
    );

    expect(await screen.findByText("Xuất sắc!")).toBeInTheDocument();
    expect(
      screen.getByText("Đang chuyển sang bài tiếp theo..."),
    ).toBeInTheDocument();
    // The answer controls are gone, so the last step cannot be submitted a second time.
    expect(
      screen.queryByRole("button", { name: "Hoàn thành bài học" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Kiểm tra" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(saveUserProgress).toHaveBeenCalledTimes(1));
    expect(saveUserProgress).toHaveBeenCalledWith("u1", 5);
  });

  it("omits the next-lesson note on the last lesson", async () => {
    const user = userEvent.setup();
    render(
      <Quiz
        questions={[questions[0]]}
        lessonId={5}
        userId="u1"
        nextLessonPath={null}
      />,
    );

    await answerCorrectly(
      user,
      "Thẻ nào tạo tiêu đề?",
      "h1",
      "Hoàn thành bài học",
    );

    expect(await screen.findByText("Xuất sắc!")).toBeInTheDocument();
    expect(
      screen.queryByText("Đang chuyển sang bài tiếp theo..."),
    ).not.toBeInTheDocument();
  });
});
