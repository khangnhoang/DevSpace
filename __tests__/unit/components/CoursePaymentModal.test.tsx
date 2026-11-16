import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoursePaymentModal from "@/app/components/CoursePaymentModal";

// Only modules outside the component are replaced (the payment actions, the toast and the image component); the
// configuration reader, the QR URL and the component's own handlers run for real.
const { cancelPayment, updatePaymentWithCoupon, toast } = vi.hoisted(() => ({
  cancelPayment: vi.fn(),
  updatePaymentWithCoupon: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/action/payment", () => ({
  cancelPayment,
  updatePaymentWithCoupon,
}));
vi.mock("sonner", () => ({ toast }));
// Not an <img>: the @next/next/no-img-element rule would warn on it.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-testid="qr-image" data-src={src} aria-label={alt} />
  ),
}));

// Invented configuration (SE-U5 G3).
const BANK = {
  NEXT_PUBLIC_PAYMENT_BANK_CODE: "VCB",
  NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER: "0000000000",
  NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME: "DEVSPACE TEST",
};
const UNAVAILABLE = /Thanh toán tạm thời chưa khả dụng/;
const course = {
  name: "JavaScript căn bản",
  slug: "javascript-can-ban",
  price: 199000,
};
const userId = "abcd1234-0000-0000-0000-000000000000";
const PAYMENT_ID = 42;
const TRANSFER = "HOCPHI%20ABCD%20PAY42%20JAVASCRIPT-CAN-BAN";

function stubBank(overrides: Partial<Record<keyof typeof BANK, string>> = {}) {
  for (const [name, value] of Object.entries({ ...BANK, ...overrides }))
    vi.stubEnv(name, value);
}

function renderModal() {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <CoursePaymentModal
      course={course}
      userId={userId}
      paymentId={PAYMENT_ID}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
  return { onClose, onSuccess, user: userEvent.setup() };
}

const qrSrc = () => screen.getByTestId("qr-image").getAttribute("data-src");
const confirmButton = () =>
  screen.getByRole("button", { name: "Tôi đã thanh toán" });

beforeEach(() => {
  vi.clearAllMocks();
  cancelPayment.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CoursePaymentModal with the bank configuration set", () => {
  it("shows a QR of the configured bank, account and name with the full price and the transfer content", () => {
    stubBank();
    renderModal();

    expect(qrSrc()).toBe(
      "https://img.vietqr.io/image/VCB-0000000000-compact2.png" +
        `?amount=199000&addInfo=${TRANSFER}&accountName=DEVSPACE%20TEST`,
    );
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it("puts the discounted amount into the QR after the server accepts a coupon", async () => {
    stubBank();
    updatePaymentWithCoupon.mockResolvedValue({
      success: true,
      newAmount: 179100,
      discountPercent: 10,
    });
    const { user } = renderModal();

    await user.type(
      screen.getByPlaceholderText("Nhập mã (VD: SV2025)"),
      "local10",
    );
    await user.click(screen.getByRole("button", { name: "Áp dụng" }));

    await waitFor(() => expect(qrSrc()).toContain("?amount=179100&"));
    expect(updatePaymentWithCoupon).toHaveBeenCalledWith(PAYMENT_ID, "LOCAL10");
    expect(qrSrc()).toContain(
      `&addInfo=${TRANSFER}&accountName=DEVSPACE%20TEST`,
    );
  });
});

describe("CoursePaymentModal without a complete bank configuration", () => {
  it.each(
    Object.keys(BANK).flatMap((name) => [
      [name, "empty", ""],
      [name, "whitespace only", "   "],
    ]),
  )(
    "shows no QR, says payment is unavailable and disables the confirm when %s is %s",
    async (name, _label, value) => {
      stubBank({ [name]: value });
      const { user, onSuccess } = renderModal();

      expect(screen.queryByTestId("qr-image")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(UNAVAILABLE);
      expect(confirmButton()).toBeDisabled();

      await user.click(confirmButton());
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it("shows no QR when a variable is not set at all", () => {
    stubBank();
    delete process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME;
    renderModal();

    expect(screen.queryByTestId("qr-image")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(UNAVAILABLE);
    expect(confirmButton()).toBeDisabled();
  });

  it("still cancels the order with the cancel button", async () => {
    stubBank({ NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER: "" });
    const { user, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(cancelPayment).toHaveBeenCalledWith(PAYMENT_ID);
    expect(toast.info).toHaveBeenCalledWith("Đã hủy giao dịch");
  });
});
