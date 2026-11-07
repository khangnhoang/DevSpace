import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionsPage from "@/app/admin/transactions/page";

// Only modules outside the page are replaced (the payment actions, the toast and the avatar image); the page's own
// loading, retry and confirm handlers run for real.
const { getAllPayments, approvePayment, rejectPayment } = vi.hoisted(() => ({
  getAllPayments: vi.fn(),
  approvePayment: vi.fn(),
  rejectPayment: vi.fn(),
}));

vi.mock("@/app/action/payment", () => ({
  getAllPayments,
  approvePayment,
  rejectPayment,
}));
// toast.promise runs the success callback like sonner does, and unwrap() settles with the action.
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    promise: (
      promise: Promise<unknown>,
      options: { success: (res: unknown) => unknown },
    ) => ({
      unwrap: () => promise.then((res) => options.success(res)),
    }),
  },
}));
vi.mock("next/image", () => ({
  default: () => <span data-testid="avatar-image" />,
}));

const pendingPayment = {
  id: 11,
  status: "pending",
  amount: 199000,
  created_at: "2026-11-01T00:00:00Z",
  courses: { name: "JavaScript căn bản" },
  users: {
    full_name: "Lê Minh Học Viên",
    email: "student@devspace.test",
    avatar_url: null,
  },
};

const LOADING = "Đang tải dữ liệu...";
const LOAD_FAILED = /Không tải được danh sách giao dịch/;

beforeEach(() => {
  getAllPayments.mockReset();
  approvePayment.mockReset();
  rejectPayment.mockReset();
});

describe("Transactions page loading", () => {
  it("shows the learner's name from the users relation", async () => {
    getAllPayments.mockResolvedValue([pendingPayment]);
    render(<TransactionsPage />);

    expect(await screen.findByText("Lê Minh Học Viên")).toBeInTheDocument();
    expect(screen.queryByText("Ẩn danh")).not.toBeInTheDocument();
  });

  it("replaces the loader with an error and a retry button when the first load fails, and retry reloads the list", async () => {
    const user = userEvent.setup();
    getAllPayments.mockRejectedValueOnce(new Error("network"));
    render(<TransactionsPage />);

    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();

    getAllPayments.mockResolvedValueOnce([pendingPayment]);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Lê Minh Học Viên")).toBeInTheDocument();
    expect(screen.queryByText(LOAD_FAILED)).not.toBeInTheDocument();
    expect(getAllPayments).toHaveBeenCalledTimes(2);
  });

  it("shows the error state when the reload after an approval fails, while the approval still reports success", async () => {
    const user = userEvent.setup();
    getAllPayments.mockResolvedValueOnce([pendingPayment]);
    approvePayment.mockResolvedValue({ success: true });
    render(<TransactionsPage />);

    await user.click(await screen.findByRole("button", { name: /^Duyệt$/ }));
    getAllPayments.mockRejectedValueOnce(new Error("network"));
    await user.click(
      await screen.findByRole("button", { name: /^Duyệt đơn$/ }),
    );

    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(approvePayment).toHaveBeenCalledWith(11);
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });
});
