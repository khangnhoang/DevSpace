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

const orderOf = (id: number, status: string, name: string) => ({
  ...pendingPayment,
  id,
  status,
  users: { ...pendingPayment.users, full_name: name },
});

describe("Transactions page status filter", () => {
  const NONE = "Không tìm thấy giao dịch nào";
  const filterButton = (name: string) => screen.getByRole("button", { name });

  it("lists only the orders of the chosen status and shows the empty text for a status without an order", async () => {
    const user = userEvent.setup();
    getAllPayments.mockResolvedValue([
      orderOf(1, "pending", "Học Viên Chờ"),
      orderOf(2, "success", "Học Viên Xong"),
      orderOf(3, "success", "Học Viên Xong Hai"),
    ]);
    render(<TransactionsPage />);
    await screen.findByText("Học Viên Chờ");

    // Every order is listed under "Tất cả".
    expect(screen.getByText("Học Viên Xong")).toBeInTheDocument();
    expect(screen.getByText("Học Viên Xong Hai")).toBeInTheDocument();

    await user.click(filterButton("Chờ duyệt"));
    expect(screen.getByText("Học Viên Chờ")).toBeInTheDocument();
    expect(screen.queryByText("Học Viên Xong")).not.toBeInTheDocument();
    expect(screen.queryByText("Học Viên Xong Hai")).not.toBeInTheDocument();

    await user.click(filterButton("Thành công"));
    expect(screen.queryByText("Học Viên Chờ")).not.toBeInTheDocument();
    expect(screen.getByText("Học Viên Xong")).toBeInTheDocument();
    expect(screen.getByText("Học Viên Xong Hai")).toBeInTheDocument();

    // No failed order exists, so the filter has nothing to list.
    await user.click(filterButton("Đã hủy"));
    expect(screen.getByText(NONE)).toBeInTheDocument();
    expect(screen.queryByText("Học Viên Chờ")).not.toBeInTheDocument();
    expect(screen.queryByText("Học Viên Xong")).not.toBeInTheDocument();

    await user.click(filterButton("Tất cả"));
    expect(screen.queryByText(NONE)).not.toBeInTheDocument();
    expect(screen.getByText("Học Viên Chờ")).toBeInTheDocument();
    expect(screen.getByText("Học Viên Xong")).toBeInTheDocument();
  });

  it("lists a failed order under the cancelled filter only", async () => {
    const user = userEvent.setup();
    getAllPayments.mockResolvedValue([
      orderOf(1, "pending", "Học Viên Chờ"),
      orderOf(4, "failed", "Học Viên Hủy"),
    ]);
    render(<TransactionsPage />);
    await screen.findByText("Học Viên Chờ");

    await user.click(filterButton("Đã hủy"));
    expect(screen.getByText("Học Viên Hủy")).toBeInTheDocument();
    expect(screen.queryByText("Học Viên Chờ")).not.toBeInTheDocument();

    await user.click(filterButton("Thành công"));
    expect(screen.getByText(NONE)).toBeInTheDocument();
    expect(screen.queryByText("Học Viên Hủy")).not.toBeInTheDocument();
  });
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
